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

/// iOS 26+ Liquid Glass capsule; below 26 a material capsule with a hairline
/// stroke so the floating shape still reads on light backgrounds.
private struct BarGlass: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 26.0, *) {
      content.glassEffect(.regular.interactive(), in: .capsule)
    } else {
      content
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.black.opacity(0.08), lineWidth: 0.5))
    }
  }
}

/// Selected-tab pill. On iOS 26 it is a second glass shape that morphs between
/// items via a shared glassEffectID; below 26 a soft capsule that slides via
/// matchedGeometryEffect.
private struct SelectionGlass: ViewModifier {
  let selected: Bool
  let namespace: Namespace.ID

  func body(content: Content) -> some View {
    if #available(iOS 26.0, *) {
      content
        .glassEffect(
          selected ? .regular.tint(Color(red: 42 / 255, green: 17 / 255, blue: 17 / 255).opacity(0.12)).interactive() : .identity,
          in: .capsule
        )
        .glassEffectID("selection", in: namespace)
    } else {
      content.background {
        if selected {
          Capsule()
            .fill(Color(red: 42 / 255, green: 17 / 255, blue: 17 / 255).opacity(0.08))
            .matchedGeometryEffect(id: "selection", in: namespace)
        }
      }
    }
  }
}

private struct TabBarContent: View {
  let items: [[String: String]]
  let selectedIndex: Int
  let onSelect: (Int) -> Void

  @Namespace private var selection

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
            }
            .foregroundStyle(selected
              ? Color(red: 42 / 255, green: 17 / 255, blue: 17 / 255)
              : Color(red: 155 / 255, green: 146 / 255, blue: 138 / 255))
            .frame(maxWidth: .infinity, minHeight: 43)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .modifier(SelectionGlass(selected: selected, namespace: selection))
        .accessibilityLabel(item["label"] ?? "")
        .accessibilityAddTraits(selected ? .isSelected : [])
      }
    }
    .padding(6)
  }

  var body: some View {
    Group {
      if #available(iOS 26.0, *) {
        GlassEffectContainer { tabRow }
      } else {
        tabRow
      }
    }
    .modifier(BarGlass())
    .animation(.smooth, value: selectedIndex)
  }
}
