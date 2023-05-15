import makeMDns from 'multicast-dns';
import _ from 'lodash';
import logger from '../log';
import mDnsGateway from '../ts/class/mDnsGatewayClass';
import whichGatewayType from './whichGatewayType';

const mDns = makeMDns();

mDns.on('response', (response: any) => {
    const { answers, additionals } = response;
    if (!Array.isArray(answers)) return;
    const responseDataList = [...answers, ...additionals];

    if (responseDataList.length === 0) return;

    const reg = RegExp(/NSPanelPro.local/gi);
    const gatewayInfo = {
        ip: '',
        name: '',
        discoveryTime: 0,
    };

    for (const item of responseDataList) {
        if (item.type !== 'A') {
            continue;
        }
        if (reg.test(`${item.name}`)) {
            gatewayInfo.ip = item.data;
            gatewayInfo.name = item.name;
            gatewayInfo.discoveryTime = Date.now();

            // logger.info('responseDataList--------------------------------', responseDataList);
        }
    }

    const { ip, name } = gatewayInfo;

    if (ip) {
        mDnsGateway.mDnsGatewayMap.set(gatewayInfo.ip, {
            ip,
            name,
            type: whichGatewayType(name),
        });
    }
});

export default mDns;
