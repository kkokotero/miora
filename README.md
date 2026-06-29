<p align="center" style="background-color: #fff;">
  <img src="misc/banner.svg" alt="Camado" />
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license" />
  </a>
  <a href="https://npmjs.org/package/camado">
    <img src="https://badgen.now.sh/npm/v/camado" alt="version" />
  </a>
  <a href="https://npmjs.org/package/camado">
    <img src="https://badgen.now.sh/npm/dm/camado" alt="downloads" />
  </a>
  <a href="https://packagephobia.now.sh/result?p=camado">
    <img src="https://img.shields.io/bundlephobia/min/camado" alt="Bundle Size" />
  </a>
  <a href="https://bundlephobia.com/result?p=camado">
    <img src="https://img.shields.io/bundlephobia/minzip/camado" alt="Bundle Size (gzip)" />
  </a>
</p>

# Camado

Camado is a TypeScript UI framework built on native DOM, fine-grained reactivity, and Web Components.

No JSX.
No Virtual DOM.
No HTML templates.

Just TypeScript DOM composition.
It is ESM-only, tree-shakeable, and split into focused subpath exports.

Camado is inspired by Lit's small, composable rendering model and Angular's structured component ergonomics.
It aims to make UI construction simpler and more visual, with a 1:1 mapping between the code tree and the rendered HTML/SVG tree.
That means the source stays close to what you see on screen: same nesting, same order, same hierarchy.

## Install

```bash
npm install camado
```

## Build

```bash
npm run build
```

## Features

- Native DOM rendering
- Fine-grained reactivity
- Web Components
- HTML and SVG factories with a 1:1 tree shape
- Component lifecycle decorators and binders
- Typed form validators and DOM binding
- ViewTransition helpers
- Browser, storage, and CSS value utilities

## Package Layout

The package is organized by concern:

- Runtime: `camado/core`, `camado/control`, `camado/navigator`, `camado/reactive`, `camado/storage`, `camado/validator`
- DOM factories: `camado/html`, `camado/svg`
- DOM modifiers: `camado/modifiers`
- Value helpers: `camado/unit`

## Quick Example

```ts
import { Component, BaseComponent, mount } from "camado/core";
import { Button, Div, H1 } from "camado/html";
import { Reactive } from "camado/reactive";
import { Event } from "camado/modifiers";

@Component({ selector: "counter-card" })
class Counter extends BaseComponent {
  @Reactive()
  count = 0;

  protected override render() {
    return Div(
      H1(`Count: ${this.count}`),
      Button(Event.click(() => this.count++), "Increment"),
    );
  }
}

mount(document.body, Counter.component());
```

## Why this API

Camado builds HTML and SVG with factories instead of JSX or a template compiler for a few reasons:

- the tree in code mirrors the tree in the DOM 1:1, so it is easier to read and reason about
- UI construction stays simpler and more visual because each node is created in the same order it appears in the rendered tree
- DOM creation happens directly in TypeScript without a compile-time transform
- modifiers stay separate from element creation, so attributes, styles, events, and observers compose cleanly
- the API keeps Lit's power for building UI from code, while still providing higher-level composition primitives and direct DOM access when you need it
- the API keeps Angular's order and hierarchy for structured components, but without Angular's ergonomics tax or framework weight
- the web is already complex enough; Camado avoids adding more complexity unless it clearly pays for itself

Templates would be a valid alternative, but they tend to split logic across markup and runtime rules. JSX would also work, but it usually adds a different authoring convention and often nudges the project toward a React-style mental model. Camado keeps the tree in code so the component graph, modifiers, and control flow stay in one place.

## How the Pieces Fit Together

- `core` mounts components and drives rendering.
- `html` and `svg` create DOM nodes in a 1:1 tree shape.
- `modifiers` add attributes, styles, events, and observers to those nodes.
- `control` keeps templates declarative.
- `validator` and `storage` handle forms and persistence.
- `navigator`, `reactive`, and `unit` cover browser actions, reactive hooks, and CSS-friendly values.

## API Reference

### `core`

Component, runtime, and rendering primitives.

Main exports:

- `Component`, `BaseComponent`, `mount`, `prepare`
- `Channel`, `Bind`, `Host`, `Query`, `Queries`, `BaseBinder`
- `Children`, `Ref`, `Output`, `Property`, `Slot`
- lifecycle decorators: `OnMount`, `OnDestroy`, `Delay`, `Interval`
- metadata/runtime helpers and DOM patch/render utilities

Example:

```ts
import { BaseComponent, Component, mount } from "camado/core";
import { H1 } from "camado/html";

@Component({ selector: "app-root" })
class App extends BaseComponent {
  protected override render() {
    return H1("Hello from Camado");
  }
}

mount(document.body, App.component());
```

#### `create` and `component`

`MyComponent.create({...})` creates the element immediately and applies the passed props during creation. `MyComponent.component()` returns a callable factory, so you can store it and invoke it with props later. Output callbacks use the public method name as the key.

Example:

```ts
import { BaseComponent, Component } from "camado/core";

@Component({ selector: "app-card" })
class AppCard extends BaseComponent {
  title = "Untitled";

  protected override render() {
    return this.title;
  }
}

const direct = AppCard.create({ title: "Created with props" });
```

Example:

```ts
import { BaseComponent, Component } from "camado/core";

@Component({ selector: "app-card" })
class AppCard extends BaseComponent {
  title = "Untitled";

  protected override render() {
    return this.title;
  }
}

const Card = AppCard.component();
const viaFactory = Card({ title: "Invoked with props" });
```

#### Using components as custom elements

Once the module defining the component is loaded, the `selector` becomes a custom HTML element tag. You can use it directly in plain HTML, pass `@Property()` fields as attributes, and project children or named slots through the light DOM.

Example:

```html
<app-card title="Hello world">
  <p>Body content</p>
  <button slot="footer">Save</button>
</app-card>
```

And in the component:

```ts
import { BaseComponent, Children, Component, Property, Slot } from "camado/core";

@Component({ selector: "app-card" })
class AppCard extends BaseComponent {
  @Property()
  title = "Untitled";

  @Children()
  content?: unknown;

  @Slot("footer")
  footer?: unknown;

  protected override render() {
    return null;
  }
}
```

#### `mount`

`mount(target, component)` appends a component factory or constructor to a DOM target.

Example:

```ts
import { BaseComponent, Component, mount } from "camado/core";
import { H1 } from "camado/html";

@Component({ selector: "app-root" })
class App extends BaseComponent {
  protected override render() {
    return H1("Hello from Camado");
  }
}

mount(document.body, App.component());
```

#### `prepare`

`prepare(...)` builds a manifest of components and a selector lookup map. Use it when you want to register a set of components ahead of time.

Example:

```ts
import { BaseComponent, Component, prepare } from "camado/core";

@Component({ selector: "app-root" })
class App extends BaseComponent {
  protected override render() {
    return null;
  }
}

const manifest = prepare(App);
console.log(manifest.selectors["app-root"]);
```

#### `Bind`

`Bind` attaches a binder instance to a component field and keeps it tied to the component lifecycle.

Create a binder with `BaseBinder`:

`bind(context)` runs once when the binder links to a component host. `unbind(context)` runs when that host disconnects.

```ts
import { BaseBinder, type BinderContext } from "camado/core";

class CounterBinder extends BaseBinder<{ changed: number }> {
  protected override bind(_context: BinderContext) {
    console.log("linked");
  }

  protected override unbind(_context: BinderContext) {
    console.log("unlinked");
  }

  bump(value: number) {
    this.channel.emit("changed", value);
  }
}
```

Use it from a component:

```ts
import { BaseComponent, Bind, Component, mount } from "camado/core";
import { H1 } from "camado/html";

@Component({ selector: "app-root" })
class App extends BaseComponent {
  @Bind(CounterBinder)
  binder!: CounterBinder;

  protected override onMount() {
    this.binder.channel.on("changed", (value) => {
      console.log(value);
    });
  }

  protected override render() {
    return H1("Hello from Camado");
  }
}

mount(document.body, App.component());
```

#### `@Host`

`@Host()` injects the current component host element into a binder field.

Example:

```ts
import { BaseBinder, Host } from "camado/core";

class ThemeBinder extends BaseBinder {
  @Host()
  host!: HTMLElement;

  readHost() {
    return this.host;
  }
}
```

#### `Self`

`Self(...)` is a render-time constructor for the component host itself, like `Div(...)` or `Svg(...)` for the host element. Put all of its children inside the call, and use it as the root of `render()`. If you place it inside another HTML/SVG constructor, Camado throws.

Example:

```ts
import { BaseComponent, Component, Self } from "camado/core";
import { Attribute } from "camado/modifiers";
import { Span } from "camado/html";

@Component({ selector: "profile-card" })
class ProfileCard extends BaseComponent {
  protected override render() {
    return Self(Attribute.class("profile-card"), Span("Body"));
  }
}
```

#### `@Query` / `@Queries`

`@Query()` resolves one element from the component host tree. `@Queries()` returns all matches as an array. Both resolve lazily when you read the field, so they are safe to use in `@OnMount()` and later.

Example:

```ts
import { BaseComponent, Component, Query, Queries } from "camado/core";
import { Attribute } from "camado/modifiers";
import { Div, Input, Span } from "camado/html";

@Component({ selector: "user-card" })
class UserCard extends BaseComponent {
  @Query("#name")
  name!: HTMLInputElement | null;

  @Queries(".item")
  items!: HTMLElement[];

  protected override render() {
    return Div(
      Input(Attribute.id("name")),
      Span(Attribute.class("item"), "A"),
      Span(Attribute.class("item"), "B"),
    );
  }
}
```

#### `Channel`

`Channel` is the tiny typed event bus that binders expose.

```ts
import { Channel } from "camado/core";

const channel = new Channel<{ ping: number }>();
channel.on("ping", (value) => console.log(value));
channel.emit("ping", 1);
```

#### `@Property`

`@Property()` marks a field as a component input or plain public property that participates in component data flow.

Example:

```ts
import { BaseComponent, Component, Property } from "camado/core";

@Component({ selector: "profile-card" })
class ProfileCard extends BaseComponent {
  @Property()
  name = "Ada";

  protected override render() {
    return null;
  }
}
```

#### `@Output`

`@Output()` wraps a public method and emits its return value as an event when you call it. The callback key matches the method name, so a `save()` output is passed as `save: (detail) => ...`.

Example:

```ts
import { BaseComponent, Component, Output } from "camado/core";

@Component({ selector: "profile-card" })
class ProfileCard extends BaseComponent {
  @Output()
  save() {
    return { ok: true } as const;
  }

  protected override render() {
    return null;
  }
}
```

#### `@Static`

`@Static()` memoizes render helpers that are expected to be stable.

Example:

```ts
import { BaseComponent, Component, Static } from "camado/core";

@Component({ selector: "profile-card" })
class ProfileCard extends BaseComponent {
  @Static()
  title() {
    return "PROFILE";
  }

  protected override render() {
    return null;
  }
}
```

#### `@Reactive`

`@Reactive()` (from `camado/reactive`) marks fine-grained state that should rerender the component when it changes.

Example:

```ts
import { BaseComponent, Component } from "camado/core";
import { Reactive } from "camado/reactive";

@Component({ selector: "counter-card" })
class CounterCard extends BaseComponent {
  @Reactive()
  count = 0;

  protected override render() {
    return null;
  }
}
```

#### `@OnMount`

`@OnMount()` runs once after the component connects to the DOM.

Example:

```ts
import { BaseComponent, Component, OnMount } from "camado/core";

@Component({ selector: "timed-card" })
class TimedCard extends BaseComponent {
  @OnMount()
  start() {
    console.log("mounted");
  }

  protected override render() {
    return null;
  }
}
```

#### `@OnDestroy`

`@OnDestroy()` runs once when the component disconnects from the DOM.

Example:

```ts
import { BaseComponent, Component, OnDestroy } from "camado/core";

@Component({ selector: "timed-card" })
class TimedCard extends BaseComponent {
  @OnDestroy()
  stop() {
    console.log("unmounted");
  }

  protected override render() {
    return null;
  }
}
```

#### `@Delay`

`@Delay(ms)` runs a method once after a delay while the component is alive.

Example:

```ts
import { BaseComponent, Component, Delay } from "camado/core";

@Component({ selector: "timed-card" })
class TimedCard extends BaseComponent {
  @Delay(250)
  later() {
    console.log("delayed");
  }

  protected override render() {
    return null;
  }
}
```

#### `@Interval`

`@Interval(ms)` runs a method repeatedly until the component disconnects.

Example:

```ts
import { BaseComponent, Component, Interval } from "camado/core";

@Component({ selector: "timed-card" })
class TimedCard extends BaseComponent {
  @Interval(1000)
  tick() {
    console.log("tick");
  }

  protected override render() {
    return null;
  }
}
```

#### `@Children`

`@Children()` captures anonymous projected children and exposes them to the component as a `DocumentFragment`.

Example:

```ts
import { BaseComponent, Children, Component } from "camado/core";
import { Div, H1 } from "camado/html";

@Component({ selector: "card-shell" })
class CardShell extends BaseComponent {
  @Children()
  content?: DocumentFragment;

  protected override render() {
    return Div(H1("Card"), this.content);
  }
}
```

#### `@Slot`

`@Slot("name")` captures named slot content and exposes it to the component as a `DocumentFragment`.

Example:

```ts
import { BaseComponent, Component, Slot } from "camado/core";
import { Div, Footer, H1 } from "camado/html";

@Component({ selector: "card-shell" })
class CardShell extends BaseComponent {
  @Slot("footer")
  footer?: DocumentFragment;

  protected override render() {
    return Div(H1("Card"), Footer(this.footer));
  }
}
```

#### `Ref`

`Ref()` creates a typed handle to a rendered DOM node.

Example:

```ts
import { Ref } from "camado/core";
import { Attributes } from "camado/modifiers";
import { Input } from "camado/html";

const inputRef = Ref<HTMLInputElement>();

export const view = Input(inputRef, Attributes.type("text"));

inputRef.current?.focus();
```

### `control`

Declarative branching, repetition, deferred rendering, and portals.

Main exports:

- `When`, `Unless`, `Show`
- `Case`, `Default`, `Switch`
- `Each`, `Repeat`
- `Lazy`, `Portal`
- aliases: `If`, `Match`, `For`

Example:

```ts
import { Div, Span } from "camado/html";
import { Each, When } from "camado/control";

const items = ["alpha", "beta", "gamma"];

export const view = Div(
  When(items.length > 0, Span("Items available"), Span("No items")),
  Each(items, (item, index) => Div(`${index + 1}. ${item}`)),
);
```

### `html`

PascalCase HTML factories for standard elements.

Main exports:

- one factory per HTML tag, for example `Div`, `Button`, `Form`, `Input`, `Section`, `Span`
- `Fragment`
- `Text`

Factories accept children only. Use `camado/modifiers` for attributes, events, and styles. This keeps element construction and behavior composition separate.

Example:

```ts
import { Button, Div, H1, P } from "camado/html";
import { Attributes, Events } from "camado/modifiers";

export const card = Div(
  Attributes.class("card"),
  H1("Hello"),
  P("This is a Camado component tree."),
  Button(
    Attributes.type("button"),
    Events.click(() => console.log("clicked")),
    "Click me",
  ),
);
```

### `svg`

PascalCase SVG factories for standard SVG elements.

Main exports:

- one factory per SVG tag, for example `Svg`, `Path`, `Circle`, `Rect`, `LinearGradient`, `Text`

SVG factories also accept children only. Use the fluent `Attribute` helper for SVG attributes and `Style`/`Events` only where they make sense on SVG nodes. `Attribute.class(...)` merges class tokens, and the helper surface includes common SVG attributes like `viewBox`, `fill`, `stroke`, `strokeWidth`, `cx`, `cy`, and `r`.

Example:

```ts
import { Circle, Svg } from "camado/svg";
import { Attribute } from "camado/modifiers";

export const icon = Svg(
  Attribute.class("icon", "icon--solid").viewBox("0 0 24 24").width(24).height(24),
  Circle(
    Attribute.cx(12).cy(12).r(10).fill("none").stroke("currentColor").strokeWidth(2),
  ),
);
```

### `modifiers`

Attribute, style, event, and observer helpers.

Main exports:

- `Attributes`, `Attribute`
- `Style`, `InlineStyle`
- `Events`, `Event`
- `Observer`

Example:

```ts
import { Button, Div } from "camado/html";
import { Attributes, Events, Style } from "camado/modifiers";

export const panel = Div(
  Attributes.class("panel"),
  Style.backgroundColor("#111827").color("white").padding("1rem"),
  Button(
    Attributes.type("button"),
    Events.click(() => console.log("save")),
    "Save",
  ),
);

// Observer tokens are inserted the same way:
// Div(Observer.visible((entry) => console.log(entry.isIntersecting)), ...)
```

### `navigator`

Browser helpers, SEO helpers, and view-transition utilities.

Main exports:

- `Navigator`
- `Seo`
- `Transition` / `ViewTransition`

Subpath types include navigation, email, notification, and transition config types.

Use `name` to tag DOM nodes, `run` for name-based updates, and `launch` when you want a start/end pair by id.

Example:

```ts
import { Button, Div } from "camado/html";
import { Attributes, Events } from "camado/modifiers";
import { Navigator, Transition } from "camado/navigator";

export const card = Div(
  Transition.name("profile-card"),
  Attributes.class("card"),
  Button(
    Attributes.type("button"),
    Events.click(() => {
      Transition.launch(
        "profile-card",
        "card-a",
        "card-detail",
        (nodes) => {
          console.log(nodes.items["profile-card"]?.firstBefore);
        },
      );
      Navigator.navigate("/dashboard", { replace: true });
    }),
    "Open dashboard",
  ),
);
```

### `reactive`

Small reactive primitives.

Main exports:

- `Event`
- `Reactive`
- `Watch`

Example:

```ts
import { Reactive, Watch } from "camado/reactive";

class CounterBinder {
  @Reactive()
  count = 0;
}

class CounterModel {
  binder = new CounterBinder();

  @Watch.of((self) => self.binder.count)
  onCountChange() {
    console.log("count changed");
  }
}
```

### `storage`

Typed storage wrappers with local, session, and memory backends.

Main exports:

- `Storage.local<T>()`
- `Storage.session<T>()`
- `Storage.memory<T>()`

Each instance exposes `get`, `set`, `remove`, `clear`, `has`, `keys`, `entries`, and `snapshot`.

Example:

```ts
import { Storage } from "camado/storage";

const prefs = Storage.memory<{ theme: string; sidebar: boolean }>("ui");

prefs.set("theme", "dark").set("sidebar", true);
console.log(prefs.get("theme"));
console.log(prefs.snapshot());
```

### `unit`

CSS and value helpers.

Main exports:

- `Css`, `CssText`, `CssFunction`
- `Angle`, `CssAngle`
- `Color`
- `Functions`
- `Length`, `CssLength`, `Unit`
- `Time`, `TimeValue`

Example:

```ts
import { Css, Color, Length } from "camado/unit";

const gap = Length.rem(1.5);
const accent = Color.rgb(15, 23, 42);
const shadow = Css.boxShadow(0, Length.px(10), Length.px(30), Color.rgba(0, 0, 0, 0.2));

console.log(String(gap), String(accent), String(shadow));
```

### `Validator`

Schema validation helpers.

Main exports:

- `Validator` / `V`
- `ValidationError`
- `Infer`

Validator schemas include string, number, boolean, date, literal, enum, array, object, and union helpers, plus common chained constraints.

Example:

```ts
import { Validator } from "camado/validator";

const userSchema = Validator.object({
  email: Validator.string().trim().email(),
  age: Validator.number().int().min(18),
});

const parsed = userSchema.parse({ email: "a@b.com", age: 21 });
console.log(parsed);
```

### `Forms Validation`

Form state and DOM binding helpers.

Main exports:

- `Field`
- `Forms`

Field blueprints and form controllers let you build typed form state with validation and DOM binding. Passing a field state directly into `Input(...)` binds it to the element so validation and UI state stay in sync.

Example:

```ts
import { BaseComponent, Component } from "camado/core";
import { Button, Form, Input, Label } from "camado/html";
import { Field, Forms } from "camado/validator";

@Component({ selector: "user-form" })
class UserForm extends BaseComponent {
  readonly form = Forms.create({
    email: Field.email().required(),
    age: Field.number().min(18),
  });

  protected override render() {
    return Form(
      Label("Email", Input(this.form.field.email)),
      Label("Age", Input(this.form.field.age)),
      Button("Submit"),
    );
  }
}
```

## Comparison

Camado takes ideas from multiple UI ecosystems while keeping a direct DOM-oriented model.

| Framework | Rendering Model | Templates | Reactivity | DOM Access | Bundle Philosophy |
|---|---|---|---|---|---|
| React | Virtual DOM | JSX | Component state | Abstracted | Full runtime |
| Vue | Virtual DOM + compiler/runtime | Templates / JSX | Reactive refs | Controlled | Progressive |
| Angular | Template compiler | HTML templates | Signals / RxJS | Framework APIs | Full platform |
| Svelte | Compile-time DOM updates | Templates | Compiler-driven | Generated code | Compile optimized |
| Solid | Fine-grained DOM updates | JSX | Signals | Direct DOM | Minimal runtime |
| Lit | Tagged templates | HTML templates | Reactive properties | Native DOM | Lightweight |
| Camado | Native DOM factories | TypeScript tree | Fine-grained decorators | Direct DOM | Tree-shakeable |

### Camado's approach

Camado does not try to replace the DOM with another abstraction.

The component tree you write is the same structure that is created in the browser.

```ts
Div(
  H1("Hello"),
  Button("Click")
)
```

becomes:

```html
<div>
  <h1>Hello</h1>
  <button>Click</button>
</div>
```

### Philosophy table

| | React | Angular | Vue | Svelte | Lit | Camado |
|---|---|---|---|---|---|---|
| JSX | ✓ | ✗ | Optional | ✗ | ✗ | ✗ |
| Virtual DOM | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Native DOM | Partial | Partial | Partial | Generated | ✓ | ✓ |
| Custom Elements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TypeScript first | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| No compiler required | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Fine-grained updates | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tree-shakeable | ✓ | Partial | ✓ | ✓ | ✓ | ✓ |

## Validation And Build

Validate the project locally with:

```bash
npm test
npm run build
```

## License

MIT

---
<p align="center">
  Built with ❤️ for great developer and user experiences.
</p>
