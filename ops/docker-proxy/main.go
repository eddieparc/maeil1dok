package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"syscall"
	"time"
)

const projectLabel = "com.docker.compose.project=maeil1dok"

var versionPrefix = regexp.MustCompile(`^/v[0-9.]+`)

type dockerProxy struct {
	client  *http.Client
	target  *url.URL
	reverse *httputil.ReverseProxy
}

type containerSummary struct {
	ID              string `json:"Id"`
	NetworkSettings struct {
		Networks map[string]struct {
			NetworkID string `json:"NetworkID"`
		} `json:"Networks"`
	} `json:"NetworkSettings"`
}

type safeInspect struct {
	ID     string `json:"Id"`
	Config struct {
		Tty bool `json:"Tty"`
	} `json:"Config"`
	State struct {
		Running    bool   `json:"Running"`
		FinishedAt string `json:"FinishedAt"`
	} `json:"State"`
}

type safeNetwork struct {
	ID       string `json:"Id"`
	Name     string `json:"Name"`
	Driver   string `json:"Driver"`
	Scope    string `json:"Scope"`
	Internal bool   `json:"Internal"`
	Ingress  bool   `json:"Ingress"`
}

func newDockerProxy(socketPath string) *dockerProxy {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var dialer net.Dialer
			return dialer.DialContext(ctx, "unix", socketPath)
		},
	}
	target := &url.URL{Scheme: "http", Host: "docker"}
	reverse := httputil.NewSingleHostReverseProxy(target)
	reverse.Transport = transport
	reverse.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, err error) {
		slog.Error("docker proxy upstream failure", "error", err)
		http.Error(writer, "docker upstream unavailable", http.StatusBadGateway)
	}
	return &dockerProxy{
		client:  &http.Client{Transport: transport, Timeout: 15 * time.Second},
		target:  target,
		reverse: reverse,
	}
}

func (proxy *dockerProxy) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(writer, "method forbidden", http.StatusForbidden)
		return
	}
	path := versionPrefix.ReplaceAllString(request.URL.Path, "")
	request.URL.RawPath = ""

	switch {
	case path == "/_ping" || path == "/version":
		proxy.reverse.ServeHTTP(writer, request)
	case path == "/networks":
		proxy.forwardProjectNetworks(writer, request)
	case path == "/containers/json":
		proxy.forwardProjectContainers(writer, request)
	case strings.HasPrefix(path, "/containers/") && strings.HasSuffix(path, "/logs"):
		proxy.forwardProjectLogs(writer, request, path)
	case strings.HasPrefix(path, "/containers/") && strings.HasSuffix(path, "/json"):
		proxy.forwardSafeInspect(writer, request, path)
	default:
		http.Error(writer, "path forbidden", http.StatusForbidden)
	}
}

func (proxy *dockerProxy) projectContainers(ctx context.Context) ([]containerSummary, error) {
	query := url.Values{
		"all":     {"1"},
		"filters": {`{"label":["` + projectLabel + `"]}`},
	}
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		proxy.target.String()+"/containers/json?"+query.Encode(),
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("create project container request: %w", err)
	}
	response, err := proxy.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("list project containers: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list project containers: status %d", response.StatusCode)
	}
	var containers []containerSummary
	if err := json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&containers); err != nil {
		return nil, fmt.Errorf("decode project containers: %w", err)
	}
	return containers, nil
}

func (proxy *dockerProxy) projectContainerAllowed(ctx context.Context, candidate string) (bool, error) {
	if len(candidate) < 12 {
		return false, nil
	}
	containers, err := proxy.projectContainers(ctx)
	if err != nil {
		return false, err
	}
	for _, container := range containers {
		if container.ID == candidate || strings.HasPrefix(container.ID, candidate) {
			return true, nil
		}
	}
	return false, nil
}

func (proxy *dockerProxy) forwardProjectContainers(
	writer http.ResponseWriter,
	request *http.Request,
) {
	request.URL.RawQuery = url.Values{
		"all":     {"1"},
		"filters": {`{"label":["` + projectLabel + `"]}`},
	}.Encode()
	proxy.reverse.ServeHTTP(writer, request)
}

func (proxy *dockerProxy) forwardProjectNetworks(
	writer http.ResponseWriter,
	request *http.Request,
) {
	containers, err := proxy.projectContainers(request.Context())
	if err != nil {
		http.Error(writer, "network authorization unavailable", http.StatusBadGateway)
		return
	}
	allowedIDs := make(map[string]struct{})
	for _, container := range containers {
		for _, network := range container.NetworkSettings.Networks {
			allowedIDs[network.NetworkID] = struct{}{}
		}
	}

	upstreamRequest, err := http.NewRequestWithContext(
		request.Context(),
		http.MethodGet,
		proxy.target.String()+"/networks",
		nil,
	)
	if err != nil {
		http.Error(writer, "network discovery unavailable", http.StatusBadGateway)
		return
	}
	response, err := proxy.client.Do(upstreamRequest)
	if err != nil {
		http.Error(writer, "network discovery unavailable", http.StatusBadGateway)
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		http.Error(writer, "network discovery unavailable", response.StatusCode)
		return
	}
	var networks []safeNetwork
	if err := json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&networks); err != nil {
		http.Error(writer, "invalid network discovery response", http.StatusBadGateway)
		return
	}
	filtered := make([]safeNetwork, 0, len(networks))
	for _, network := range networks {
		if _, allowed := allowedIDs[network.ID]; allowed {
			filtered = append(filtered, network)
		}
	}
	writer.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(writer).Encode(filtered); err != nil {
		slog.Error("encode project networks", "error", err)
	}
}

func containerID(path, suffix string) string {
	return strings.TrimSuffix(strings.TrimPrefix(path, "/containers/"), suffix)
}

func (proxy *dockerProxy) forwardProjectLogs(
	writer http.ResponseWriter,
	request *http.Request,
	path string,
) {
	allowed, err := proxy.projectContainerAllowed(
		request.Context(),
		containerID(path, "/logs"),
	)
	if err != nil {
		http.Error(writer, "container authorization unavailable", http.StatusBadGateway)
		return
	}
	if !allowed {
		http.Error(writer, "container forbidden", http.StatusForbidden)
		return
	}
	proxy.reverse.ServeHTTP(writer, request)
}

func (proxy *dockerProxy) forwardSafeInspect(
	writer http.ResponseWriter,
	request *http.Request,
	path string,
) {
	allowed, err := proxy.projectContainerAllowed(
		request.Context(),
		containerID(path, "/json"),
	)
	if err != nil {
		http.Error(writer, "container authorization unavailable", http.StatusBadGateway)
		return
	}
	if !allowed {
		http.Error(writer, "container forbidden", http.StatusForbidden)
		return
	}
	upstreamRequest := request.Clone(request.Context())
	upstreamRequest.URL.Scheme = proxy.target.Scheme
	upstreamRequest.URL.Host = proxy.target.Host
	upstreamRequest.RequestURI = ""
	response, err := proxy.client.Do(upstreamRequest)
	if err != nil {
		http.Error(writer, "container inspect unavailable", http.StatusBadGateway)
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		http.Error(writer, "container inspect unavailable", response.StatusCode)
		return
	}
	var inspect safeInspect
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&inspect); err != nil {
		http.Error(writer, "invalid container inspect response", http.StatusBadGateway)
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(writer).Encode(inspect); err != nil {
		slog.Error("encode safe container inspect", "error", err)
	}
}

func main() {
	proxy := newDockerProxy("/var/run/docker.sock")
	server := &http.Server{
		Addr:              ":2375",
		Handler:           proxy,
		ReadHeaderTimeout: 5 * time.Second,
	}
	shutdownContext, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()
	go func() {
		<-shutdownContext.Done()
		context, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(context); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("docker proxy shutdown", "error", err)
		}
	}()
	slog.Info("docker proxy listening", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("docker proxy failed", "error", err)
		os.Exit(1)
	}
}
