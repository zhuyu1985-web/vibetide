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
  if (!pathname.startsWith("/data-collection")) return null;
  const root: Crumb = { label: "检索工作台", href: "/data-collection/content" };

  if (pathname === "/data-collection/content") return null;

  if (pathname === "/data-collection/topics") {
    return [root, { label: "主题词库" }];
  }
  return [root, { label: "详情" }];
}

export function ReportsBreadcrumb() {
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
