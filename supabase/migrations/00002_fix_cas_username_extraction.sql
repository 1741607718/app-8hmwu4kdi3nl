-- 修复CAS用户名提取逻辑的迁移脚本

-- 更新用户自动同步触发器函数
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
  
  -- 优先使用用户元数据中的真实用户名，否则从email中提取
  IF NEW.raw_user_meta_data->>'username' IS NOT NULL AND NEW.raw_user_meta_data->>'username' != '' THEN
    extracted_username := NEW.raw_user_meta_data->>'username';
  ELSIF NEW.email LIKE '%@miaoda.com' THEN
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
  )
  ON CONFLICT (id) DO NOTHING; -- 如果用户已存在则不执行任何操作
  RETURN NEW;
END;
$$;

-- 重新创建触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();