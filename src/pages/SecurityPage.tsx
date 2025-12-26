import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Camera, AlertTriangle } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          安保监控
        </h1>
        <p className="text-muted-foreground mt-1">监控设备状态与安全事件统计</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Camera className="h-4 w-4" />
              监控在线
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156/160 <span className="text-sm font-normal text-muted-foreground">台</span></div>
            <p className="text-xs text-muted-foreground mt-1">在线率: 97.5%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              本月案事件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3 <span className="text-sm font-normal text-muted-foreground">起</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">反诈劝阻</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12 <span className="text-sm font-normal text-muted-foreground">次</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>监控设备分布</CardTitle>
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
