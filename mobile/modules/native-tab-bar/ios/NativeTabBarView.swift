import ExpoModulesCore
import SwiftUI

final class NativeTabBarView: ExpoView {
  let onTabSelect = EventDispatcher()

  var items: [[String: String]] = [] {
    didSet { render() }
  }
  var selectedIndex = 0 {
    didSet { render() }
  }

  private lazy var host = UIHostingController(
    rootView: TabBarContent(items: [], selectedIndex: 0) { _ in }
  )

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    host.overrideUserInterfaceStyle = .light

    let hostedView = host.view!
    hostedView.backgroundColor = .clear
    hostedView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(hostedView)
    NSLayoutConstraint.activate([
      hostedView.leadingAnchor.constraint(equalTo: leadingAnchor),
      hostedView.trailingAnchor.constraint(equalTo: trailingAnchor),
      hostedView.topAnchor.constraint(equalTo: topAnchor),
      hostedView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
  }

  private func render() {
    host.rootView = TabBarContent(
      items: items,
      selectedIndex: selectedIndex
    ) { [weak self] index in
      self?.onTabSelect(["index": index])
    }
  }
}

/// Light native-shell tokens from DESIGN.md.
private enum TabBarPalette {
  static let surface = Color.white
  static let border = Color(red: 233 / 255, green: 228 / 255, blue: 222 / 255)
  static let selected = Color(red: 243 / 255, green: 238 / 255, blue: 238 / 255)
  static let active = Color(red: 42 / 255, green: 17 / 255, blue: 17 / 255)
  static let inactive = Color(red: 107 / 255, green: 98 / 255, blue: 91 / 255)
  static let shadow = Color(red: 31 / 255, green: 26 / 255, blue: 23 / 255)
}

private struct TabBarPressStyle: ButtonStyle {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(configuration.isPressed ? 0.85 : 1)
      .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
      .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: configuration.isPressed)
  }
}

private struct TabBarContent: View {
  let items: [[String: String]]
  let selectedIndex: Int
  let onSelect: (Int) -> Void

  @Namespace private var selection
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private var tabRow: some View {
    HStack(spacing: 0) {
      ForEach(Array(items.enumerated()), id: \.offset) { index, item in
        let selected = index == selectedIndex
        Button {
          onSelect(index)
        } label: {
          VStack(spacing: 3) {
            Image(systemName: item[selected ? "selectedSymbol" : "symbol"] ?? "circle")
              .font(.system(size: 22, weight: .medium))
              .frame(height: 25)
            Text(item["label"] ?? "")
              .font(.system(size: 11, weight: selected ? .semibold : .medium))
              .lineLimit(1)
          }
          .foregroundStyle(selected ? TabBarPalette.active : TabBarPalette.inactive)
          .frame(maxWidth: .infinity, minHeight: 44)
          .background {
            if selected {
              Capsule()
                .fill(TabBarPalette.selected)
                .matchedGeometryEffect(id: "selection", in: selection)
            }
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(TabBarPressStyle())
        .accessibilityLabel(item["label"] ?? "")
        .accessibilityAddTraits(selected ? .isSelected : [])
      }
    }
    .padding(6)
  }

  var body: some View {
    tabRow
      .background(TabBarPalette.surface, in: Capsule())
      .overlay(Capsule().strokeBorder(TabBarPalette.border, lineWidth: 1))
      .shadow(color: TabBarPalette.shadow.opacity(0.08), radius: 12, y: 4)
      .environment(\.colorScheme, .light)
      .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: selectedIndex)
  }
}
