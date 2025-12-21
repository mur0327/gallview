/**
 * CORS Anywhere Proxy Server
 * DCInside 등 외부 사이트의 이미지를 가져오기 위한 프록시 서버입니다.
 * https://github.com/Rob--W/cors-anywhere
 */

const cors_proxy = require("cors-anywhere");

const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || 8080;

cors_proxy
  .createServer({
    originWhitelist: [], // 모든 origin 허용 (필요시 제한 가능)
    requireHeader: ["origin", "x-requested-with"],
    removeHeaders: ["cookie", "cookie2"],
    redirectSameOrigin: true,
    httpProxyOptions: {
      xfwd: false, // X-Forwarded-* 헤더 비활성화
    },
  })
  .listen(port, host, () => {
    console.log(`CORS Anywhere proxy running on ${host}:${port}`);
  });
