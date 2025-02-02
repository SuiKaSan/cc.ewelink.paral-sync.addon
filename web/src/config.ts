import EEnv from '../src/ts/enum/EEnv';

const isTestEnv = () => import.meta.env.DEV;
/** 
* 环境
* environment
*/
const env = isTestEnv() ? EEnv.TEST : EEnv.PROD;

/** 
* 调试用ip
* Debugging IP
*/
const NSPanelProIp = import.meta.env.VITE_APP_IHOST_IP ?? 'localhost';
/** 
* 版本(从.env文件获取) 
* Version (obtained from .env file)
*/
const version = import.meta.env.VITE_VERSION;

/** 
* 请求 baseURL
* Request baseURL
*/
const apiUrl = `http://${NSPanelProIp}:8322/api/v1`;

// 请求用ak/sk Request ak/sk
const TEST_APPID = 'DP1ydXVV50xwj9Pi';
const TEST_SECRET = 'gHDu79PCw*yR%wtfmy5YUzo!yknm74xz';
const PROD_APPID = 'DP1ydXVV50xwj9Pi';
const PROD_SECRET = 'gHDu79PCw*yR%wtfmy5YUzo!yknm74xz';
const appId = isTestEnv() ? TEST_APPID : PROD_APPID;
const appSecret = isTestEnv() ? TEST_SECRET : PROD_SECRET;
const sseUrl = isTestEnv() ? `//${NSPanelProIp}:8322/api/v1/sse` : '/api/v1/sse';

console.log(`current version: ${version}`);

export { apiUrl, appSecret, appId, env, sseUrl, version };
