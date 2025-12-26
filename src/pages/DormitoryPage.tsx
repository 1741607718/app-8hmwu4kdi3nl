import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserCheck, UserX } from 'lucide-react';

export default function DormitoryPage() {
  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          宿管数据
        </h1>
        <p className="text-muted-foreground mt-1">宿舍入住与归宿情况监控</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              总住宿人数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8,500 <span className="text-sm font-normal text-muted-foreground">人</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-chart-4" />
              已归宿
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">8,234 <span className="text-sm font-normal text-muted-foreground">人</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4 text-warning" />
              未归宿
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">266 <span className="text-sm font-normal text-muted-foreground">人</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">归宿率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">96.9%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>归宿情况趋势</CardTitle>
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
