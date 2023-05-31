import _ from 'lodash';
import { GatewayDeviceItem } from '../ts/interface/CubeApi';
import { DestServerSentEvent } from '../ts/class/destSse';
import { ServerSentEvent } from '../ts/class/srcSse';
import logger from '../log';
import db from './db';
import CubeApi from '../lib/cube-api';
import { ERR_CUBEAPI_GET_DEVICE_TIMEOUT, ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID, ERR_DEST_GATEWAY_IP_INVALID, ERR_DEST_GATEWAY_TOKEN_INVALID, ERR_INTERNAL_ERROR, ERR_NO_SRC_GATEWAY_INFO, ERR_SRC_GATEWAY_IP_INVALID, ERR_SRC_GATEWAY_TOKEN_INVALID, toResponse } from './error';
import IResponse from '../ts/interface/IResponse';
import { destTokenInvalid, srcTokenAndIPInvalid } from './dealError';

export interface ISrcGatewayDevice {
    /** 目标网关mac地址 */
    srcGatewayMac: string;
    /** 设备列表 */
    deviceList: GatewayDeviceItem[]
}

/** 同步来源网关的设备数据组 */
export const srcGatewayDeviceGroup: ISrcGatewayDevice[] = [];

/** 同步目标网关的设备数据组 */
export let destGatewayDeviceGroup: GatewayDeviceItem[] = [];

/** 目标网关sse */
export let destSseEvent: DestServerSentEvent | null = null;

/** 来源网关sse合集 */
export const srcSsePool: Map<string, ServerSentEvent> = new Map();


/**
 * @description 更新
 * @export
 */
export function updateDestSse(sse: DestServerSentEvent) {
    logger.info("[updateDestSse] dest sse updated")
    destSseEvent = sse;
}

/**
 * 更新同步来源网关的设备数据组
 *
 * @param srcGatewayMac 同步来源网关 MAC 地址
 * @param deviceList 同步来源网关的设备数据
 */
export async function updateSrcGatewayDeviceGroup(srcGatewayMac: string, deviceList: GatewayDeviceItem[]) {
    const srcGatewayInfoList = await db.getDbValue('srcGatewayInfoList');
    const srcGatewayInfo = _.find(srcGatewayInfoList, { mac: srcGatewayMac });
    if (!srcGatewayInfo) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_NO_SRC_GATEWAY_INFO`);
        return toResponse(ERR_NO_SRC_GATEWAY_INFO);
    }
    if (!srcGatewayInfo.ipValid) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_SRC_GATEWAY_IP_INVALID`);
        return toResponse(ERR_SRC_GATEWAY_IP_INVALID);
    }
    if (!srcGatewayInfo.tokenValid) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_SRC_GATEWAY_TOKEN_INVALID`);
        return toResponse(ERR_SRC_GATEWAY_TOKEN_INVALID);
    }

    const groupItem = _.find(srcGatewayDeviceGroup, { srcGatewayMac });
    if (groupItem) {
        groupItem.deviceList = deviceList;
    } else {
        srcGatewayDeviceGroup.push({
            srcGatewayMac,
            deviceList
        });
    }
}


/**
 * @description 获取指定来源网关的设备列表
 * @export
 * @param {string} srcGatewayMac
 * @returns {*}  {Promise<IResponse>}
 */
export async function getSrcGatewayDeviceGroup(srcGatewayMac: string): Promise<IResponse> {
    const groupItem = _.find(srcGatewayDeviceGroup, { srcGatewayMac });
    // 存在直接返回
    if (groupItem) {
        return {
            error: 0,
            msg: "success",
            data: groupItem
        };
    }

    /** 所有来源网关的信息 */
    const srcGatewayInfoList = await db.getDbValue('srcGatewayInfoList');

    /** 当前网关信息 */
    const srcGateway = _.find(srcGatewayInfoList, { mac: srcGatewayMac });

    if (!srcGateway) {
        logger.info(`[getSrcGatewayDeviceGroup] get src gateway ${srcGatewayMac} from srcGatewayInfoList fails. Here is the list ${srcGatewayInfoList}`)
        return {
            error: 606,
            msg: "src gateway not exist",
            data: []
        };
    }

    const ApiClient = CubeApi.ihostApi;
    const srcGatewayClint = new ApiClient({ ip: srcGateway.ip, at: srcGateway.token });
    const cubeApiRes = await srcGatewayClint.getDeviceList();
    if (cubeApiRes.error === 0) {
        await updateSrcGatewayDeviceGroup(srcGatewayMac, cubeApiRes.data);
        return cubeApiRes;
    } else if (cubeApiRes.error === 400) {
        logger.warn(`[getSrcGatewayDeviceGroup] NSPro should LOGIN!!!`);
        return toResponse(ERR_INTERNAL_ERROR);
    } else if (cubeApiRes.error === 401) {
        logger.info(`[getSrcGatewayDeviceGroup] RESPONSE: ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID`);
        await srcTokenAndIPInvalid('token', srcGateway.mac);
        return toResponse(ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID);
    } else if (cubeApiRes.error === 1000) {
        logger.info(`[getSrcGatewayDeviceGroup] RESPONSE: ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID`);
        await srcTokenAndIPInvalid('ip', srcGateway.mac);
        return toResponse(ERR_CUBEAPI_GET_DEVICE_TIMEOUT);
    } else {
        logger.warn(`[getSrcGatewayDeviceGroup]  unknown error: ${JSON.stringify(cubeApiRes)}`);
        return toResponse(ERR_INTERNAL_ERROR);
    }
}


/**
 * 更新目标网关的设备数据组
 *
 * @param deviceList 同步来源网关的设备数据
 */
export async function updateDestGatewayDeviceGroup(deviceList: GatewayDeviceItem[]) {
    /** 同步目标网关的信息 */
    const destGatewayInfo = await db.getDbValue('destGatewayInfo');
    if (!destGatewayInfo?.ipValid) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_DEST_GATEWAY_IP_INVALID`);
        toResponse(ERR_DEST_GATEWAY_IP_INVALID);
    }
    if (!destGatewayInfo?.tokenValid) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_DEST_GATEWAY_TOKEN_INVALID`);
        toResponse(ERR_DEST_GATEWAY_TOKEN_INVALID);
    }

    destGatewayDeviceGroup = deviceList;
}


/**
 * @description 获取目标网关的设备列表
 * @export
 * @returns {*}  {Promise<IResponse>}
 */
export async function getDestGatewayDeviceGroup(): Promise<IResponse> {

    // 存在直接返回
    if (destGatewayDeviceGroup.length) {
        return {
            error: 0,
            msg: "success",
            data: destGatewayDeviceGroup
        };
    }

    /** 目标网关的信息 */
    const destGatewayInfo = await db.getDbValue('destGatewayInfo');

    if (!destGatewayInfo) {
        logger.info(`[getSrcGatewayDeviceGroup] get dest gateway from destGatewayInfo fails. Here is the list ${destGatewayInfo}`)
        return {
            error: 606,
            msg: "dest gateway not exist",
            data: []
        };
    }


    // 获取同步目标网关的设备列表
    const ApiClient = CubeApi.ihostApi;
    const destGatewayClient = new ApiClient({ ip: destGatewayInfo.ip, at: destGatewayInfo.token });
    const cubeApiRes = await destGatewayClient.getDeviceList();
    logger.info(`(service.syncOneDevice) destGatewayClient.getDeviceList() cubeApiRes: ${JSON.stringify(cubeApiRes)}`);
    if (cubeApiRes.error === 0) {
        destGatewayDeviceGroup = cubeApiRes.data.device_list;
        return cubeApiRes;
    } else if (cubeApiRes.error === 401) {
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID`);
        return toResponse(ERR_CUBEAPI_GET_DEVICE_TOKEN_INVALID);
    } else if (cubeApiRes.error === 1000) {
        await destTokenInvalid();
        logger.info(`(service.syncOneDevice) RESPONSE: ERR_CUBEAPI_GET_DEVICE_TIMEOUT`);
        return toResponse(ERR_CUBEAPI_GET_DEVICE_TIMEOUT);
    } else {
        logger.warn(`(service.syncOneDevice) destGatewayClient.getDeviceList() unknown error: ${JSON.stringify(cubeApiRes)}`);
        return toResponse(ERR_INTERNAL_ERROR);
    }
}