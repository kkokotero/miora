import { BaseComponent, Component } from "ustro/core";
import { H1 } from "ustro/html";

@Component({ selector: "app-component" })
class AppComponent extends BaseComponent {
  protected override render() {
    return H1("Hello, World!");
  }
}

export default AppComponent.component();
