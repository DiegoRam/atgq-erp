"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

interface FacetFilterProps {
  title: string;
  options: FacetOption[];
  selected: string[];
  onSelect: (selected: string[]) => void;
}

const VISIBLE_LIMIT = 8;

export function FacetFilter({
  title,
  options,
  selected,
  onSelect,
}: FacetFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleOptions =
    expanded || options.length <= VISIBLE_LIMIT
      ? options
      : options.slice(0, VISIBLE_LIMIT);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onSelect(selected.filter((v) => v !== value));
    } else {
      onSelect([...selected, value]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selected.length}
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        {visibleOptions.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={() => toggle(option.value)}
            />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {option.count}
            </span>
          </label>
        ))}
      </div>
      {options.length > VISIBLE_LIMIT && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Ver menos"
            : `Ver todos (${options.length - VISIBLE_LIMIT} más)`}
        </Button>
      )}
    </div>
  );
}
