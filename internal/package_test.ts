import { assertEquals } from "@std/assert";
import { getPackage } from "@tugrulates/internal/package";

Deno.test("getPackage()", async () => {
  const pkg = await getPackage();
  assertEquals(pkg.name, "@tugrulates/internal");
});
