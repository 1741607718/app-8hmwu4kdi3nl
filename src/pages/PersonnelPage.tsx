import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp } from 'lucide-react';

export default function PersonnelPage() {
  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          人员管理
        </h1>
        <p className="text-muted-foreground mt-1">校园人员统计与流量监测</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">在校人数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15,234 <span className="text-sm font-normal text-muted-foreground">人</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日访客</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342 <span className="text-sm font-normal text-muted-foreground">人</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日人流量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8,567 <span className="text-sm font-normal text-muted-foreground">人次</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            人流量趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            数据图表开发中...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
