import type { MaybePromise } from '../ports/index.js';

export const isPromiseLike = <T>(value: MaybePromise<T>): value is Promise<T> => {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
};

export const chainMaybePromise = <TValue, TResult>(
  value: MaybePromise<TValue>,
  mapper: (value: TValue) => MaybePromise<TResult>,
): MaybePromise<TResult> => {
  return isPromiseLike(value) ? value.then(mapper) : mapper(value);
};

export const mapMaybePromise = <TValue, TResult>(
  value: MaybePromise<TValue>,
  mapper: (value: TValue) => TResult,
): MaybePromise<TResult> => {
  return isPromiseLike(value) ? value.then(mapper) : mapper(value);
};

export const catchMaybePromise = <TValue>(
  work: () => MaybePromise<TValue>,
  onError: (error: unknown) => MaybePromise<TValue>,
): MaybePromise<TValue> => {
  try {
    const result = work();
    return isPromiseLike(result) ? result.catch(onError) : result;
  } catch (error) {
    return onError(error);
  }
};
