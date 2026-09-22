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
  var bottomInset: CGFloat = 0 {
    didSet { render() }
  }

  private lazy var host = UIHostingController(
    rootView: TabBarContent(items: [], selectedIndex: 0, bottomInset: 0) { _ in }
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
      selectedIndex: selectedIndex,
      bottomInset: bottomInset
    ) { [weak self] index in
      self?.onTabSelect(["index": index])
    }
  }
}

private struct TabBarContent: View {
  let items: [[String: String]]
  let selectedIndex: Int
  let bottomInset: CGFloat
  let onSelect: (Int) -> Void

  var body: some View {
    VStack(spacing: 0) {
      Divider()
        .overlay(Color(red: 233 / 255, green: 228 / 255, blue: 222 / 255))
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
            .frame(maxWidth: .infinity, minHeight: 49)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel(item["label"] ?? "")
          .accessibilityAddTraits(selected ? .isSelected : [])
        }
      }
      .frame(height: 55)
      Spacer(minLength: bottomInset)
    }
    .background(.regularMaterial)
  }
}
