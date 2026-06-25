import { BaseComponent, Component } from "camado/core";
import { H1 } from "camado/html";

@Component({ selector: "app-component" })
class AppComponent extends BaseComponent {
  protected override render() {
    return H1("Hello, World!");
  }
}

export default AppComponent.component();
