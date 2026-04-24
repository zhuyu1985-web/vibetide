"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Crumb = { label: string; href?: string };

function resolveCrumbs(pathname: string): Crumb[] | null {
  if (!pathname.startsWith("/research")) return null;
  const root: Crumb = { label: "检索工作台", href: "/research" };

  if (pathname === "/research") return null;

  if (pathname === "/research/admin/media-outlets") {
    return [root, { label: "媒体源管理" }];
  }
  if (pathname === "/research/admin/topics") {
    return [root, { label: "主题词库" }];
  }
  if (pathname === "/research/admin/tasks") {
    return [root, { label: "数据采集任务" }];
  }
  if (pathname === "/research/admin/tasks/new") {
    return [
      root,
      { label: "数据采集任务", href: "/research/admin/tasks" },
      { label: "新建任务" },
    ];
  }
  if (/^\/research\/admin\/tasks\/[^/]+$/.test(pathname)) {
    return [
      root,
      { label: "数据采集任务", href: "/research/admin/tasks" },
      { label: "任务详情" },
    ];
  }
  return [root, { label: "详情" }];
}

export function ResearchBreadcrumb() {
  const pathname = usePathname();
  const crumbs = resolveCrumbs(pathname);
  if (!crumbs) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !c.href ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
