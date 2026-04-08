import RuovafApp from '@/components/RuovafApp';
import { Toaster } from '@/components/ui/toaster';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <RuovafApp />
      <Toaster />
    </div>
  );
}