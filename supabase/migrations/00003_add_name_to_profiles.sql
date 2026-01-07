-- 添加真实姓名字段到用户配置表

-- 添加name字段到profiles表
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- 更新现有用户记录，从user_metadata中提取真实姓名
UPDATE public.profiles 
SET name = (auth.users.raw_user_meta_data->>'name') 
FROM auth.users 
WHERE profiles.id = auth.users.id 
  AND profiles.name IS NULL 
  AND auth.users.raw_user_meta_data->>'name' IS NOT NULL;

-- 创建函数来更新用户全名
CREATE OR REPLACE FUNCTION update_user_name_from_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- 从用户元数据中获取姓名
  user_name := NEW.raw_user_meta_data->>'name';
  
  -- 如果获取到姓名，则更新profiles表
  IF user_name IS NOT NULL AND user_name != '' THEN
    INSERT INTO public.profiles (id, username, email, name)
    VALUES (NEW.id, SPLIT_PART(NEW.email, '@', 1), NEW.email, user_name)
    ON CONFLICT (id) 
    DO UPDATE SET name = user_name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 为新用户创建触发器，当用户元数据更新时自动更新姓名
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_name_from_metadata();