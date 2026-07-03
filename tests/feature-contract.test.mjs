import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const css = readFileSync(new URL("styles.css", root), "utf8");
const js = readFileSync(new URL("app.js", root), "utf8");

test("creation form keeps presets and supports second-level custom duration", () => {
  assert.match(html, /id="decay-select"/);
  assert.match(html, /value="60"/);
  assert.match(html, /id="custom-duration-value"/);
  assert.match(html, /id="custom-duration-unit"/);
  assert.match(js, /function getSelectedDecaySeconds/);
});

test("task cards expose duration editing without counting as renew", () => {
  assert.match(js, /function updateTaskDuration/);
  assert.match(js, /class="[^"]*duration-editor[^"]*"/);
  assert.match(js, /data-duration-unit/);
});

test("theme switching persists user preference", () => {
  assert.match(html, /id="btn-theme-toggle"/);
  assert.match(css, /data-theme="light"/);
  assert.match(js, /THEME:/);
  assert.match(js, /function applyTheme/);
});

test("completion and expiry have particle dispersal hooks", () => {
  assert.match(html, /id="particle-layer"/);
  assert.match(css, /\.particle/);
  assert.match(js, /function spawnParticles/);
  assert.match(js, /kind === 'ash'/);
});

test("mobile app exposes four destinations and task detail", () => {
  for (const id of [
    "view-today",
    "view-timeline",
    "view-report",
    "view-settings",
    "task-detail-view",
    "bottom-nav",
    "task-sheet",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(js, /function setActiveView/);
  assert.match(js, /function openTaskDetail/);
  assert.match(js, /function closeTaskDetail/);
});

test("new views have dedicated renderers and legacy task normalization", () => {
  for (const renderer of [
    "renderToday",
    "renderTaskDetail",
    "renderTimeline",
    "renderReport",
    "renderSettings",
  ]) {
    assert.match(js, new RegExp(`function ${renderer}`));
  }

  assert.match(js, /function normalizeTask/);
  assert.match(js, /priority:/);
  assert.match(js, /subtasks:/);
});

test("reference visual system includes mobile navigation and risk colors", () => {
  assert.match(css, /--color-acid:/);
  assert.match(css, /--color-warning:/);
  assert.match(css, /--color-danger:/);
  assert.match(css, /\.bottom-nav/);
  assert.match(css, /\.completion-ring/);
  assert.match(css, /\.task-risk-rail/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test("empty report uses neutral chart states", () => {
  assert.match(js, /donut\.classList\.toggle\('empty', snapshot\.active === 0\)/);
  assert.match(js, /trend\.classList\.toggle\('empty', hasNoTrendData\)/);
  assert.match(css, /\.decay-donut\.empty/);
  assert.match(css, /\.trend-bars\.empty/);
});

test("today summary filters active completed and risk task lists", () => {
  for (const filter of ["active", "completed", "risk"]) {
    assert.match(html, new RegExp(`data-task-filter="${filter}"`));
  }

  assert.match(js, /taskFilter: 'active'/);
  assert.match(js, /function setTaskFilter/);
  assert.match(js, /function getTodayTasks/);
  assert.match(js, /completedAt:/);
  assert.match(js, /completionDecay:/);
  assert.match(css, /\.metric-filter\.is-active/);
});
