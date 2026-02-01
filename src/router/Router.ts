export interface Screen {
  mount(container: HTMLElement): void;
  unmount(): void;
}

type ScreenFactory = () => Screen;

export class Router {
  private container: HTMLElement;
  private routes = new Map<string, ScreenFactory>();
  private current: Screen | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  register(route: string, factory: ScreenFactory) {
    this.routes.set(route, factory);
  }

  go(route: string) {
    const factory = this.routes.get(route);
    if (!factory) throw new Error(`Unknown route: ${route}`);

    this.current?.unmount();
    this.current = factory();

    this.container.innerHTML = "";
    this.current.mount(this.container);
  }
}
