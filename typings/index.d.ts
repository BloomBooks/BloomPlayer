/// <reference path="globals/react-dom/index.d.ts" />
/// <reference path="globals/react/index.d.ts" />

// Allows for polyfill in pagePlayer/app.ts
interface Array<T> {
  find(predicate: (search: T) => boolean): T;
}
