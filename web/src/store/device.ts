import { defineStore } from 'pinia';
import {stepsList} from '@/api/ts/interface/IGateWay';
import api from '../api';
import _ from 'lodash';
import type { IGateWayInfoData , INsProDeviceData} from '@/api/ts/interface/IGateWay';
import router from '@/router';
import moment from 'moment';

interface IDeviceState {
    /** 用户所处的步骤 */
    step:stepsList,
    /** IHost数据 */
    iHostList:IGateWayInfoData[],
    /** nsPro 数据 */
    nsProList:IGateWayInfoData[],
    /** 网关下所有的子设备 */
    deviceList: INsProDeviceData[],
    /**  */
}

export const useDeviceStore = defineStore('addon_device', {
    state: (): IDeviceState => {
        return {
            step:stepsList.FIRST,
            iHostList:[],
            nsProList:[],
            deviceList:[],
        };
    },
    actions: {
        /** 设置步骤 */
        setStep(step:stepsList){
            this.step = step;
        },

        /**获取iHost本机的网关信息*/
        async getIHostGateWatList(){
            const res = await api.NSPanelPro.getOurselfGateWayInfo();
            if(res.error === 0 && res.data){
                this.iHostList = [res.data];
            }else{
                this.iHostList = [];
            }
            console.log('res',res);
            return res;
        },

        /** 获取nspro  */
        async getNsProGateWayInfo(){
            const res = await api.NSPanelPro.getNsProGateWayInfo();
            if(res.error === 0 && res.data){
                this.nsProList = res.data;
            }else{
                this.nsProList = [];
            }
            return res;
        },

        /** 获取网关下所有的子设备 */
        async getDeviceList(){
            let mac = '';
            this.nsProList.map((item)=>{
                if(item.tokenValid && item.token){
                    mac = item.mac;
                }
            });

            if(!mac)return;

            const res = await api.NSPanelPro.getDeviceList(mac);

            if (res.error === 0 && res.data) {
                this.deviceList = res.data;
                this.deviceList.map((device) => {
                    return device.spinLoading=false;
                });
            }else{
                this.deviceList = [];
            }

            if (res.error === 1401) {
                router.push('/setting');
            }
        },
        /** 设置loading转圈 */
        setLoading(item:INsProDeviceData,status:boolean){
            if(!item || this.deviceList.length<1)return;
            this.deviceList.map((device)=>{
                if(device.id === item.id){
                    device.spinLoading=status;
                }
            });
        },
        /** 根据id去修改nsPro的数据列表（同步的时候不再查询列表） */
        modifyNsProListById(id:string|number,status:boolean){
            if(this.deviceList.length<1)return;

            this.deviceList.map((item)=>{
                if(item.id === id){
                    item.isSynced = status;
                }
            })
        }
    },
    getters: {
        /** 已经有一个网关获取到token或者在倒计时 */
        hasTokenOrTs(state) {
            const hasTokenOrTs = state.nsProList.some((item) => {
                if (item.tokenValid && item.ipValid) {
                    return true;
                }
                if (item.ts) {
                    const timeGap = moment(moment()).diff(moment(Number(item.ts)), 'seconds');
                    if (timeGap <= 300 && timeGap >= 0) {
                        return true;
                    }
                }
                return false;
            });
            return hasTokenOrTs;
        },
    },
    persist: true,
});
