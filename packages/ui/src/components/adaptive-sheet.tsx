"use client";

import * as React from "react";
import { cn } from "cn";
import { useIsMobile } from "#hooks/use-mobile";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@bill-splitter/ui/components/drawer";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@bill-splitter/ui/components/sheet";

type AdaptiveSheetContextValue = {
  isMobile: boolean;
};

const AdaptiveSheetContext = React.createContext<AdaptiveSheetContextValue | null>(null);

function useAdaptiveSheet() {
  const context = React.useContext(AdaptiveSheetContext);
  if (!context) {
    throw new Error("useAdaptiveSheet must be used within an AdaptiveSheet.");
  }
  return context;
}

type AdaptiveSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
  showSwipeHandle?: boolean;
  swipeDirection?: "down" | "up" | "left" | "right";
  children?: React.ReactNode;
};

function AdaptiveSheet({
  open,
  onOpenChange,
  defaultOpen,
  modal = true,
  showSwipeHandle = true,
  swipeDirection = "down",
  children,
}: AdaptiveSheetProps) {
  const isMobile = useIsMobile();
  const contextValue = React.useMemo(() => ({ isMobile }), [isMobile]);

  return (
    <AdaptiveSheetContext.Provider value={contextValue}>
      {isMobile ? (
        <Drawer
          open={open}
          onOpenChange={onOpenChange}
          defaultOpen={defaultOpen}
          modal={modal}
          showSwipeHandle={showSwipeHandle}
          swipeDirection={swipeDirection}
        >
          {children}
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen} modal={modal}>
          {children}
        </Sheet>
      )}
    </AdaptiveSheetContext.Provider>
  );
}

function AdaptiveSheetTrigger(props: React.ComponentProps<typeof SheetTrigger>) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerTrigger {...props} />;
  }
  return <SheetTrigger {...props} />;
}

function AdaptiveSheetClose(props: React.ComponentProps<typeof SheetClose>) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerClose {...props} />;
  }
  return <SheetClose {...props} />;
}

type AdaptiveSheetContentProps = React.ComponentProps<typeof SheetContent>;

function AdaptiveSheetContent({
  className,
  side = "right",
  showCloseButton = true,
  children,
  ...props
}: AdaptiveSheetContentProps) {
  const { isMobile } = useAdaptiveSheet();

  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[90dvh]", className)} {...props}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <SheetContent side={side} showCloseButton={showCloseButton} className={className} {...props}>
      {children}
    </SheetContent>
  );
}

function AdaptiveSheetHeader(props: React.ComponentProps<"div">) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerHeader {...props} />;
  }
  return <SheetHeader {...props} />;
}

function AdaptiveSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="adaptive-sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-2", className)}
      {...props}
    />
  );
}

function AdaptiveSheetFooter(props: React.ComponentProps<"div">) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerFooter {...props} />;
  }
  return <SheetFooter {...props} />;
}

function AdaptiveSheetTitle(props: React.ComponentProps<typeof SheetTitle>) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerTitle {...props} />;
  }
  return <SheetTitle {...props} />;
}

function AdaptiveSheetDescription(props: React.ComponentProps<typeof SheetDescription>) {
  const { isMobile } = useAdaptiveSheet();
  if (isMobile) {
    return <DrawerDescription {...props} />;
  }
  return <SheetDescription {...props} />;
}

export {
  AdaptiveSheet,
  AdaptiveSheetTrigger,
  AdaptiveSheetClose,
  AdaptiveSheetContent,
  AdaptiveSheetHeader,
  AdaptiveSheetBody,
  AdaptiveSheetFooter,
  AdaptiveSheetTitle,
  AdaptiveSheetDescription,
  useAdaptiveSheet,
};
