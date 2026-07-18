// dev only: HMR server for theme iteration; production is the static docs/ bundle
import index from "./index.html";

Bun.serve({
  port: Number(process.env.PORT),
  hostname: "0.0.0.0", // dev server default binds localhost, unreachable from outside the container
  development: true,
  routes: { "/": index },
});
