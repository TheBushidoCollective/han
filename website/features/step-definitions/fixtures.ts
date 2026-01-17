import { test as base, createBdd } from "playwright-bdd";

export const test = base;

const { Given, When, Then } = createBdd(test);

export { Given, When, Then };
