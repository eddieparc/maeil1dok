import ExpoModulesCore

public final class NativeTabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeTabBar")

    View(NativeTabBarView.self) {
      Events("onTabSelect")

      Prop("items") { (view: NativeTabBarView, items: [[String: String]]) in
        view.items = items
      }
      Prop("selectedIndex") { (view: NativeTabBarView, selectedIndex: Int) in
        view.selectedIndex = selectedIndex
      }
      Prop("bottomInset") { (view: NativeTabBarView, bottomInset: Double) in
        view.bottomInset = CGFloat(bottomInset)
      }
    }
  }
}
