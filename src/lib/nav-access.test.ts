import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeeNavHref, canSeeSettingsHref, defaultHrefsForRole, homePathForNav, MENU_CHOICES, pathAllowedForNav } from "./nav-access";

describe("nav access", () => {
  it("sends the cashier to Loyalty only", () => {
    const ctx = { role: "BRANCH" as const, mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(homePathForNav(ctx), "/loyalty");
    assert.equal(pathAllowedForNav(ctx, "/loyalty"), true);
    assert.equal(pathAllowedForNav(ctx, "/control-tower"), false);
    assert.equal(pathAllowedForNav(ctx, "/broadcast"), false);
    assert.equal(pathAllowedForNav(ctx, "/settings"), false);
    assert.equal(canSeeNavHref(ctx, "/loyalty"), true);
    assert.equal(canSeeNavHref(ctx, "/customers"), false);
  });

  it("lets Brand Admin open the menu-access settings page", () => {
    const ctx = { role: "CLIENT_ADMIN", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(canSeeSettingsHref(ctx, "/settings/access"), true);
  });

  it("honours a saved checkbox list", () => {
    const ctx = {
      role: "BRANCH",
      mode: "brand",
      isAgencyStaff: false,
      isPlatformAdmin: false,
      hrefs: ["/loyalty", "/customers"],
    };
    assert.equal(pathAllowedForNav(ctx, "/customers"), true);
    assert.equal(pathAllowedForNav(ctx, "/broadcast"), false);
    assert.equal(homePathForNav(ctx), "/loyalty");
  });

  it("hides sprint and P2P internals from Brand Admin", () => {
    const ctx = { role: "CLIENT_ADMIN", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(canSeeSettingsHref(ctx, "/settings/loyalty"), true);
    assert.equal(canSeeSettingsHref(ctx, "/settings/sprints"), false);
    assert.equal(canSeeSettingsHref(ctx, "/settings/errors"), false);
    assert.equal(canSeeSettingsHref(ctx, "/settings/api"), false);
    assert.equal(canSeeSettingsHref(ctx, "/settings/pages"), false);
    assert.equal(canSeeSettingsHref(ctx, "/settings/metrics"), false);
    assert.equal(canSeeSettingsHref(ctx, "/settings/broadcast"), false);
    assert.equal(pathAllowedForNav(ctx, "/control-tower"), true);
    assert.equal(pathAllowedForNav(ctx, "/loyalty"), true);
  });

  it("keeps sprint for Super Admin", () => {
    const ctx = { role: "SUPER_ADMIN", mode: "agency", isAgencyStaff: true, isPlatformAdmin: true };
    assert.equal(canSeeSettingsHref(ctx, "/settings/sprints"), true);
    assert.equal(canSeeSettingsHref(ctx, "/settings/broadcast"), true);
    assert.equal(homePathForNav(ctx), "/clients");
  });

  it("shows Commerce to brand admin and hides it from the cashier", () => {
    const admin = { role: "CLIENT_ADMIN", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    const branch = { role: "BRANCH", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(MENU_CHOICES.some((choice) => choice.href === "/commerce"), true);
    assert.equal(defaultHrefsForRole("CLIENT_ADMIN").includes("/commerce"), true);
    assert.equal(defaultHrefsForRole("HQ_OPS").includes("/commerce"), true);
    assert.equal(defaultHrefsForRole("BRANCH").includes("/commerce"), false);
    assert.equal(canSeeNavHref(admin, "/commerce"), true);
    assert.equal(pathAllowedForNav(admin, "/commerce"), true);
    assert.equal(canSeeNavHref(branch, "/commerce"), false);
    assert.equal(pathAllowedForNav(branch, "/commerce"), false);
  });

  it("keeps Invoice print on platform Super Admin only", () => {
    const platform = { role: "SUPER_ADMIN", mode: "platform", isAgencyStaff: true, isPlatformAdmin: true };
    const brand = { role: "CLIENT_ADMIN", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(canSeeNavHref(platform, "/billing"), true);
    assert.equal(canSeeNavHref(brand, "/billing"), false);
    assert.equal(pathAllowedForNav(brand, "/billing"), false);
  });

  it("keeps Training and Pitch deck on platform only", () => {
    const platform = { role: "SUPER_ADMIN", mode: "platform", isAgencyStaff: true, isPlatformAdmin: true };
    const agency = { role: "SUPER_ADMIN", mode: "agency", isAgencyStaff: true, isPlatformAdmin: true };
    const brand = { role: "CLIENT_ADMIN", mode: "brand", isAgencyStaff: false, isPlatformAdmin: false };
    assert.equal(canSeeNavHref(platform, "/deck_train"), true);
    assert.equal(canSeeNavHref(platform, "/deck_pitch"), true);
    assert.equal(canSeeNavHref(agency, "/deck_train"), false);
    assert.equal(canSeeNavHref(agency, "/deck_pitch"), false);
    assert.equal(pathAllowedForNav(agency, "/deck_train"), false);
    assert.equal(canSeeNavHref(brand, "/deck_train"), false);
    assert.equal(pathAllowedForNav(brand, "/deck_train"), false);
  });
});
