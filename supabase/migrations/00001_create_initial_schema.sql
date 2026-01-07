-- 创建用户角色枚举（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('user', 'admin');
    END IF;
END
$$;

-- 创建用户配置表
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  department TEXT,
  permissions JSONB DEFAULT '{"canExport": false, "dataScope": []}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建车辆数据缓存表
CREATE TABLE public.vehicle_data (
  id BIGSERIAL PRIMARY KEY,
  plate_number TEXT NOT NULL,
  recognition_code TEXT,
  recognition_name TEXT,
  station_code TEXT,
  station_name TEXT,
  pass_time TIMESTAMPTZ NOT NULL,
  data_source TEXT DEFAULT 'api',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建消防设备数据缓存表
CREATE TABLE public.fire_equipment_data (
  id BIGSERIAL PRIMARY KEY,
  equipment_number TEXT NOT NULL,
  check_date DATE NOT NULL,
  status TEXT,
  location_code TEXT,
  location_name TEXT,
  data_source TEXT DEFAULT 'api',
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建人员数据统计表
CREATE TABLE public.personnel_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  total_count INTEGER DEFAULT 0,
  visitor_count INTEGER DEFAULT 0,
  flow_count INTEGER DEFAULT 0,
  data_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建安保数据统计表
CREATE TABLE public.security_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  monitor_online INTEGER DEFAULT 0,
  monitor_total INTEGER DEFAULT 0,
  incident_count INTEGER DEFAULT 0,
  fraud_prevention_count INTEGER DEFAULT 0,
  data_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建宿管数据统计表
CREATE TABLE public.dormitory_stats (
  id BIGSERIAL PRIMARY KEY,
  stat_date DATE NOT NULL,
  total_count INTEGER DEFAULT 0,
  checked_in INTEGER DEFAULT 0,
  checked_out INTEGER DEFAULT 0,
  data_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_vehicle_data_pass_time ON public.vehicle_data(pass_time DESC);
CREATE INDEX idx_vehicle_data_plate ON public.vehicle_data(plate_number);
CREATE INDEX idx_fire_equipment_check_date ON public.fire_equipment_data(check_date DESC);
CREATE INDEX idx_personnel_stats_date ON public.personnel_stats(stat_date DESC);
CREATE INDEX idx_security_stats_date ON public.security_stats(stat_date DESC);
CREATE INDEX idx_dormitory_stats_date ON public.dormitory_stats(stat_date DESC);

-- 创建用户自动同步触发器
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  extracted_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- 从email中提取用户名 (支持多种邮箱后缀)
  IF NEW.email LIKE '%@miaoda.com' THEN
    extracted_username := REPLACE(NEW.email, '@miaoda.com', '');
  ELSIF NEW.email LIKE '%@cas.wzbc.edu.cn' THEN
    extracted_username := REPLACE(NEW.email, '@cas.wzbc.edu.cn', '');
  ELSE
    -- 默认情况下，去掉第一个@符号后的部分
    extracted_username := SPLIT_PART(NEW.email, '@', 1);
  END IF;
  
  -- 插入用户配置
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    extracted_username,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- 创建辅助函数检查管理员权限
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::public.user_role
  );
$$;

-- 创建公开视图
CREATE VIEW public_profiles AS
  SELECT id, username, role, department FROM profiles;

-- 启用RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_equipment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dormitory_stats ENABLE ROW LEVEL SECURITY;

-- Profiles 权限策略
CREATE POLICY "管理员可以查看所有用户" ON profiles
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以查看自己的信息" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "管理员可以更新所有用户" ON profiles
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "用户可以更新自己的信息(除角色外)" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- 数据表权限策略 - 所有认证用户可读
CREATE POLICY "认证用户可以查看车辆数据" ON vehicle_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "认证用户可以查看消防设备数据" ON fire_equipment_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "认证用户可以查看人员统计" ON personnel_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "认证用户可以查看安保统计" ON security_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "认证用户可以查看宿管统计" ON dormitory_stats
  FOR SELECT TO authenticated USING (true);

-- 管理员可以插入数据
CREATE POLICY "管理员可以插入车辆数据" ON vehicle_data
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "管理员可以插入消防设备数据" ON fire_equipment_data
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "管理员可以插入人员统计" ON personnel_stats
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "管理员可以插入安保统计" ON security_stats
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "管理员可以插入宿管统计" ON dormitory_stats
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));