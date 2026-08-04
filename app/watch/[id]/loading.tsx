export default function WatchLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 animate-pulse">
          <img src="/icon.svg" alt="Logo" className="w-full h-full" />
        </div>
        
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-border rounded-full" />
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
        </div>
        
        <p className="text-muted-foreground text-sm animate-pulse">
          Загрузка плеера и серии...
        </p>
      </div>
    </div>
  )
}