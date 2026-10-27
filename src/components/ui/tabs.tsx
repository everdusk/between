"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-foreground/[0.06]",
        line: "gap-1 bg-transparent",
        /** Floating glass dock used for the app's bottom navigation. */
        dock: "glass-chrome gap-1 p-1.5 touch-manipulation",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, onPointerDown, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-200 outline-none select-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:bg-card data-active:text-foreground data-active:shadow-[0_1px_2px_oklch(0_0_0_/_0.06)]",
        "group-data-[variant=default]/tabs-list:hover:text-foreground",
        "group-data-[variant=dock]/tabs-list:h-12 group-data-[variant=dock]/tabs-list:touch-manipulation group-data-[variant=dock]/tabs-list:active:scale-[0.97] group-data-[variant=dock]/tabs-list:data-active:bg-foreground group-data-[variant=dock]/tabs-list:data-active:text-background group-data-[variant=dock]/tabs-list:data-active:shadow-[0_10px_24px_-14px_var(--foreground)]",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:shadow-none",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
        event.currentTarget.click();
      }}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
