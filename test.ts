const kv = await Deno.openKv(":memory:");
await kv.set(["foo"], 42);
console.log(await kv.get(["foo"]));
kv.close();
