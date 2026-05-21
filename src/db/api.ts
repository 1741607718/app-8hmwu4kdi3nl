import type {
  FireEquipmentData,
  VisitorData,
  CameraDevice,
  CameraStats,
} from '@/types/types';
import {
  fetchVehicleData,
  fetchVisitorData,
  type VehicleApiData,
  fetchCameraStats,
  fetchCameraDevices,
} from '@/services/externalApi';

function convertApiToVehicleData(apiData: VehicleApiData[]) {
  return apiData.map(item => ({
    id: Math.random() * 1000000,
    plate_number: item.cph,
    recognition_code: item.qcysdm,
    recognition_name: item.qcysmc,
    station_code: item.sbtdbm,
    station_name: item.sbtdmc,
    pass_time: item.zpsj,
    data_source: 'api',
    raw_data: item,
    created_at: new Date().toISOString(),
  }));
}

export async function getVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    const result = await fetchVehicleData({
      startDate: params?.startDate,
      endDate: params?.endDate,
    });

    if (!result.success || !result.data) {
      console.error('获取车辆API数据失败:', result.error);
      return [];
    }

    const convertedData = convertApiToVehicleData(result.data);
    if (params?.limit) {
      return convertedData.slice(0, params.limit);
    }

    return convertedData;
  } catch (error) {
    console.error('获取车辆数据失败:', error);
    return [];
  }
}

export async function getVehicleStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; byDate: Record<string, number> }> {
  const data = await getVehicleData(params);

  const byDate: Record<string, number> = {};
  data.forEach(item => {
    const date = item.pass_time.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return {
    total: data.length,
    byDate,
  };
}

export async function getFireEquipmentData(_params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<FireEquipmentData[]> {
  console.warn('fetchFireSafetyData函数未实现，返回空数组');
  return [];
}

export async function getFireEquipmentStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; normal: number; abnormal: number }> {
  const data = await getFireEquipmentData(params);

  const normal = data.filter(item => item.status === '正常' || item.status === '0').length;
  const abnormal = data.length - normal;

  return {
    total: data.length,
    normal,
    abnormal,
  };
}

function convertDbToVisitorData(dbRecords: any[]): VisitorData[] {
  return dbRecords.map(item => ({
    id: Math.random() * 1000000,
    guid: item.GUID,
    xm: item.XM,
    lxfs: item.LXDH,
    sfzh: item.SFZH,
    dwmc: item.DWMC,
    rlsc: item.RLSC,
    lflx: item.LFLX,
    lfsy: item.LFSY,
    dfsj: item.DFSJ,
    lfsj: item.LFSJ,
    bfbm: item.BFBM,
    bfrs: item.BFRY,
    lfcl: item.LFCL,
    sys_userid: item.SYS_USERID,
    sys_username: item.SYS_USERNAME,
    sys_useraccount: item.SYS_USERACCOUNT,
    sys_companyid: item.SYS_COMPANYID,
    sys_companyname: item.SYS_COMPANYNAME,
    sys_departmentid: item.SYS_DEPARTMENTID,
    sys_departmentname: item.SYS_DEPARTMENTNAME,
    sys_useremail: item.SYS_USEREMAIL,
    sys_userphone: item.SYS_USERPHONE,
    sys_jobid: item.SYS_JOBID,
    sys_jobname: item.SYS_JOBNAME,
    sys_applydate: item.SYS_APPLYDATE,
    sys_orgpath: item.SYS_ORGPATH,
    sys_applyno: item.SYS_APPLYNO,
    system_processname: item.SYSTEM_PROCESSNAME,
    system_incident: item.SYSTEM_INCIDENT,
    system_status: item.SYSTEM_STATUS,
    system_endtime: item.SYSTEM_ENDTIME,
    bfbmid: item.BFBMID,
    bfrysjh: item.BFRYSJH,
    fkth: item.FKTH,
    data_source: 'database',
    raw_data: item,
    created_at: new Date().toISOString(),
  }));
}

export async function getVisitorData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<VisitorData[]> {
  try {
    const result = await fetchVisitorData({
      startDate: params?.startDate,
      endDate: params?.endDate,
      pageSize: params?.limit || 1000,
    });

    if (!result.success || !result.data) {
      console.error('获取访客API数据失败:', result.error);
      return [];
    }

    return convertDbToVisitorData(result.data);
  } catch (error) {
    console.error('获取访客数据失败:', error);
    return [];
  }
}

export async function getVisitorStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; byDate: Record<string, number> }> {
  const data = await getVisitorData(params);

  const byDate: Record<string, number> = {};
  data.forEach(item => {
    const date = item.dfsj ? item.dfsj.split('T')[0] : 'unknown';
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return {
    total: data.length,
    byDate,
  };
}

export async function getCameraStats(): Promise<CameraStats> {
  try {
    const result = await fetchCameraStats();

    if (!result.success || !result.data) {
      console.error('获取监控统计数据失败:', result.error);
      return {
        onlineCount: 0,
        faceRecognitionCount: 0,
        totalCount: 0,
        barrierGateCount: 0,
      };
    }

    return {
      onlineCount: result.data.onlineCount,
      faceRecognitionCount: result.data.faceRecognitionCount,
      totalCount: result.data.totalCount,
      barrierGateCount: result.data.barrierGateCount || 0,
    };
  } catch (error) {
    console.error('获取监控统计数据失败:', error);
    return {
      onlineCount: 0,
      faceRecognitionCount: 0,
      totalCount: 0,
      barrierGateCount: 0,
    };
  }
}

export { fetchCameraDevices };

export async function getCameraDevices(params?: {
  page?: number;
  pageSize?: number;
  type?: 'all' | 'online' | 'offline' | 'face-recognition';
}): Promise<CameraDevice[]> {
  try {
    const result = await fetchCameraDevices({
      page: params?.page,
      pageSize: params?.pageSize,
      type: params?.type,
    });

    if (!result.success || !result.data) {
      console.error('获取摄像头设备详情失败:', result.error);
      return [];
    }

    return result.data;
  } catch (error) {
    console.error('获取摄像头设备数据失败:', error);
    return [];
  }
}
