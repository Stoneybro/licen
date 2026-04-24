"use client";
import { Skeleton } from "../ui/skeleton";
export default function LoginFormSkeleton() {
  return (
    <div className={"flex flex-col gap-6 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm md:p-7"}>
      <div className='flex flex-col items-center gap-2 text-center'>
        <div className='h-16 w-16 rounded-full bg-muted/50' />
        <h1 className='text-2xl font-semibold tracking-tight'>Sign in to LICEN</h1>
        <p className='text-muted-foreground text-sm text-balance'>
          Choose a method to continue to your dashboard.
        </p>
      </div>
      <div className='grid gap-3'>
        <Skeleton className='w-full h-11' />
        <Skeleton className='w-full h-11' />
        <Skeleton className='w-full h-11' />
        <Skeleton className='w-full h-11' />
      </div>
      <Skeleton className='mx-auto h-3 w-56' />
    </div>
  );
}
