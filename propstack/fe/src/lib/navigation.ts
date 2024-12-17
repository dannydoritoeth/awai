// Navigation state store
class NavigationStore {
  private _isBackNavigation = false

  get isBackNavigation() {
    return this._isBackNavigation
  }

  set isBackNavigation(value: boolean) {
    this._isBackNavigation = value
  }
}

export const navigationStore = new NavigationStore() 