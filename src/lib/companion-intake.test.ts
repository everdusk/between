import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceCompanionIntake } from "./companion-intake";
import { emptyCompanion } from "./companion-memory";

test("an existing pilot user can start the intake without clearing recent conversation", () => {
  const state = {
    ...emptyCompanion(),
    recent: [{ user: "Привет", reply: "Привет!" }],
  };
  assert.match(
    advanceCompanionIntake(state, { text: "", start: true })!.text,
    /Как мне к тебе обращаться/,
  );
  assert.match(
    advanceCompanionIntake(state, { text: "Маша" })!.text,
    /Приятно, Маша/,
  );
  const rating = advanceCompanionIntake(state, {
    text: "Не высыпаюсь, тревожусь о работе",
  });
  assert.match(rating!.text, /работой и сном/);
  assert.equal(rating!.rows!.flat().length, 10);
  assert.match(
    advanceCompanionIntake(state, { text: "", action: "ci:rating:4" })!.text,
    /4 из 10/,
  );
  assert.equal(
    advanceCompanionIntake(state, { text: "", action: "ci:rating:7" })!.text,
    "",
  );
  assert.match(
    advanceCompanionIntake(state, { text: "", action: "ci:choice:later" })!
      .text,
    /Напиши вечером/,
  );
  assert.equal(advanceCompanionIntake(state, { text: "Продолжим" }), null);
  assert.deepEqual(state.recent, [{ user: "Привет", reply: "Привет!" }]);
});

test("topic buttons, typed rating, and typed continuation work together", () => {
  const state = emptyCompanion();
  advanceCompanionIntake(state, { text: "", start: true });
  assert.equal(
    advanceCompanionIntake(state, { text: "Ник" })!.rows!.flat().length,
    5,
  );
  assert.match(
    advanceCompanionIntake(state, { text: "", action: "ci:topic:sleep" })!.text,
    /от 1 до 10/,
  );
  assert.match(
    advanceCompanionIntake(state, { text: "11" })!.text,
    /от 1 до 10/,
  );
  assert.match(
    advanceCompanionIntake(state, { text: "6 из 10" })!.text,
    /6 из 10/,
  );
  assert.equal(
    advanceCompanionIntake(state, {
      text: "Сегодня опять долго не получалось уснуть",
    }),
    null,
  );
  assert.equal(state.intake?.step, "done");
});
