/**
 * 敏感数据脱敏工具
 */

/**
 * 对姓名进行脱敏
 * @param name 姓名
 * @returns 脱敏后的姓名，保留首尾字符，中间用*代替
 */
export function maskName(name: string): string {
  if (!name) return name;
  if (name.length <= 1) return '*';
  if (name.length === 2) return name.charAt(0) + '*';
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
}

/**
 * 对学工号进行脱敏
 * @param id 学工号
 * @returns 脱敏后的学工号，保留前后各2位，中间用*代替
 */
export function maskStudentId(id: string): string {
  if (!id) return id;
  if (id.length <= 4) return '*'.repeat(id.length);
  return id.substring(0, 2) + '*'.repeat(id.length - 4) + id.substring(id.length - 2);
}

/**
 * 对身份证号进行脱敏
 * @param idCard 身份证号
 * @returns 脱敏后的身份证号，保留前6位和后4位，中间用*代替
 */
export function maskIdCard(idCard: string): string {
  if (!idCard) return idCard;
  if (idCard.length !== 18) {
    // 如果不是标准18位身份证号，采用通用处理
    if (idCard.length <= 4) return '*'.repeat(idCard.length);
    return idCard.substring(0, 2) + '*'.repeat(idCard.length - 4) + idCard.substring(idCard.length - 2);
  }
  return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

/**
 * 对电话号码进行脱敏
 * @param phone 电话号码
 * @returns 脱敏后的电话号码，保留前3位和后4位，中间用****代替
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  if (phone.length < 7) return '*'.repeat(phone.length);
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

/**
 * 对车牌号进行脱敏
 * @param plate 车牌号
 * @returns 脱敏后的车牌号，保留前2位和最后1位，中间用*代替
 */
export function maskPlateNumber(plate: string): string {
  if (!plate) return plate;
  if (plate.length <= 3) return '*'.repeat(plate.length);
  return plate.substring(0, 2) + '*'.repeat(plate.length - 3) + plate.substring(plate.length - 1);
}

/**
 * 统一的敏感数据脱敏函数
 * @param data 原始数据对象
 * @param fields 需要脱敏的字段列表
 * @returns 脱敏后的数据对象
 */
export function maskSensitiveData<T extends Record<string, any>>(data: T, fields: string[]): T {
  if (!data || typeof data !== 'object') return data;
  
  const maskedData = { ...data };
  
  for (const field of fields) {
    if (maskedData.hasOwnProperty(field)) {
      const value = maskedData[field];
      if (typeof value === 'string') {
        switch (field.toLowerCase()) {
          case 'name':
          case 'xm': // 姓名
          case 'ownername': // 车主姓名
            maskedData[field] = maskName(value);
            break;
          case 'studentid':
          case 'gh': // 工号/学号
          case 'xh': // 学号
            maskedData[field] = maskStudentId(value);
            break;
          case 'idcard':
          case 'sfzh': // 身份证号
            maskedData[field] = maskIdCard(value);
            break;
          case 'phone':
          case 'lxdh': // 联系电话
          case 'lxfs': // 联系方式
            maskedData[field] = maskPhone(value);
            break;
          // 车牌号不再脱敏
          case 'plate':
          case 'cp': // 车牌号
          case 'lfcl': // 来访车辆
            // 不进行脱敏处理，保留原始值
            break;
          default:
            // 默认使用姓名脱敏规则
            maskedData[field] = maskName(value);
            break;
        }
      }
    }
  }
  
  return maskedData;
}

/**
 * 批量脱敏数据数组
 * @param dataArray 数据数组
 * @param fields 需要脱敏的字段列表
 * @returns 脱敏后的数据数组
 */
export function maskSensitiveDataArray<T extends Record<string, any>>(
  dataArray: T[],
  fields: string[]
): T[] {
  if (!dataArray || !Array.isArray(dataArray)) return dataArray;
  
  return dataArray.map(item => maskSensitiveData(item, fields));
}