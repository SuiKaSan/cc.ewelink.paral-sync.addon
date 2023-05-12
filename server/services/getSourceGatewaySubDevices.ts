import { Request, Response } from 'express';
import { toResponse } from '../utils/error';
import logger from '../log';
import EErrorCode from '../ts/enum/EErrorCode';

/** 获取所有网关下的子设备(1400) */
export default async function getSourceGatewaySubDevices(req: Request, res: Response) {
    try {
        return res.json(toResponse(EErrorCode.GATEWAY_NOT_TOKEN, 'fail to get gateway device'));

        return res.json(toResponse(0));
    } catch (error: any) {
        logger.error(`get iHost token code error----------------: ${error.message}`);
        res.json(toResponse(500));
    }
}
