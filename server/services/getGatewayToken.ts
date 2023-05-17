import _ from 'lodash';
import { Request, Response } from 'express';
import {
    ERR_CUBEAPI_GET_GATEWAY_TOKEN_TIMEOUT,
    ERR_GATEWAY_IP_INVALID,
    ERR_NO_SUCH_GATEWAY,
    ERR_SUCCESS,
    toResponse
} from '../utils/error';
import logger from '../log';
import DB from '../utils/db';
import CubeApi from '../lib/cube-api';

/** 获取iHost/NSPanelPro凭证(1200) */
export default async function getGatewayToken(req: Request, res: Response) {
    try {
        /** 请求的网关 MAC 地址 */
        const reqGatewayMac = req.params.mac;
        /** 本地存储的网关信息列表 */
        const localGatewayInfoList = await DB.getDbValue('gatewayInfoList');
        /** 请求的网关信息 */
        const reqGatewayInfo = _.find(localGatewayInfoList, { mac: reqGatewayMac });

        logger.info(`(service.getGatewayToken) reqGatewayMac: ${reqGatewayMac}`);
        logger.info(`(service.getGatewayToken) localGatewayInfoList: ${JSON.stringify(localGatewayInfoList)}`);
        logger.info(`(service.getGatewayToken) reqGatewayInfo: ${JSON.stringify(reqGatewayInfo)}`);

        if (!reqGatewayInfo) {
            logger.info(`(service.getGatewayToken) response: ERR_NO_SUCH_GATEWAY`);
            return res.json(toResponse(ERR_NO_SUCH_GATEWAY));
        }
        if (!reqGatewayInfo.ipValid) {
            logger.info(`(service.getGatewayToken) response: ERR_GATEWAY_IP_INVALID`);
            return res.json(toResponse(ERR_GATEWAY_IP_INVALID));
        }

        if (!reqGatewayInfo.tokenValid) {
            // 如果请求的网关凭证无效，则调用获取网关凭证接口
            const ApiClient = CubeApi.ihostApi;
            const reqGatewayClient = new ApiClient({ ip: reqGatewayInfo.ip });
            let cubeApiRes = null;
            // TODO: 添加 timeout, interval 的配置
            cubeApiRes = await reqGatewayClient.getBridgeAT({});
            logger.info(`(service.getGatewayToken) reqGatewayClient.getBridgeAT() res: ${JSON.stringify(cubeApiRes)}`);

            const resError = _.get(cubeApiRes, 'error');
            const resData = _.get(cubeApiRes, 'data') as any;
            if (resError === 0) {
                // 请求成功更新本地存储的数据
                logger.info(`(service.getGatewayToken) before update -> localGatewayInfoList: ${JSON.stringify(localGatewayInfoList)}`);
                reqGatewayInfo.token = resData.token;
                reqGatewayInfo.tokenValid = true;
                reqGatewayInfo.ts = `${Date.now()}`;
                logger.info(`(service.getGatewayToken) after update -> localGatewayInfoList: ${JSON.stringify(localGatewayInfoList)}`);
                // TODO: acquire lock
                await DB.setDbValue('gatewayInfoList', localGatewayInfoList);
                logger.info(`(service.getGatewayToken) response: Success`);
                return res.json(toResponse(ERR_SUCCESS, 'Success', reqGatewayInfo));
            } else {
                logger.info(`(service.getGatewayToken) response: ERR_CUBEAPI_GET_GATEWAY_TOKEN_TIMEOUT`);
                return res.json(toResponse(ERR_CUBEAPI_GET_GATEWAY_TOKEN_TIMEOUT));
            }
        } else {
            logger.info(`(service.getGatewayToken) response: Success`);
            return res.json(toResponse(ERR_SUCCESS, 'Success', reqGatewayInfo));
        }
    } catch (error: any) {
        logger.error(`get iHost token code error----------------: ${error.message}`);
        res.json(toResponse(500));
    }
}
