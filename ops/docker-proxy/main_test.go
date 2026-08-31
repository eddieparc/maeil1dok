package main

import (
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
)

func testProxy(t *testing.T, upstream http.Handler) *dockerProxy {
	t.Helper()
	server := httptest.NewServer(upstream)
	t.Cleanup(server.Close)
	target, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parse upstream URL: %v", err)
	}
	reverse := httptest.NewServer(nil)
	reverse.Close()
	proxy := newDockerProxy("/does/not/exist")
	proxy.target = target
	proxy.client = server.Client()
	proxy.reverse = httputilProxy(target, server.Client().Transport)
	return proxy
}

func httputilProxy(target *url.URL, transport http.RoundTripper) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = transport
	return proxy
}

func Test_DockerProxy_inspect_removes_environment_secrets(t *testing.T) {
	const id = "1234567890abcdef"
	upstream := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/containers/json":
			writer.Write([]byte(`[{"Id":"` + id + `"}]`))
		case "/containers/" + id + "/json":
			writer.Write([]byte(`{"Id":"` + id + `","Config":{"Tty":false,"Env":["SECRET=leak"]},"State":{"Running":true,"FinishedAt":"0001-01-01T00:00:00Z"}}`))
		default:
			http.NotFound(writer, request)
		}
	})
	proxy := testProxy(t, upstream)
	request := httptest.NewRequest(http.MethodGet, "/containers/"+id+"/json", nil)
	response := httptest.NewRecorder()

	proxy.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if strings.Contains(response.Body.String(), "SECRET") {
		t.Fatalf("inspect response leaked environment: %s", response.Body.String())
	}
}

func Test_DockerProxy_denies_mutation_and_other_projects(t *testing.T) {
	upstream := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Write([]byte(`[]`))
	})
	proxy := testProxy(t, upstream)

	for _, path := range []string{
		"/containers/create",
		"/containers/aaaaaaaaaaaa/logs",
	} {
		request := httptest.NewRequest(http.MethodPost, path, nil)
		response := httptest.NewRecorder()
		proxy.ServeHTTP(response, request)
		if response.Code != http.StatusForbidden {
			t.Fatalf("%s expected 403, got %d", path, response.Code)
		}
	}
}
