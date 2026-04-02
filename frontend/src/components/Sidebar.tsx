interface SidebarProps {
  categories: string[];
  activeCategory: string;
  onSelect: (value: string) => void;
}

function formatCategoryLabel(category: string): string {
  if (category === "all") {
    return "All Issues";
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function Sidebar({ categories, activeCategory, onSelect }: SidebarProps) {
  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <h2>Categories</h2>
      </div>
      <div className="stack">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={category === activeCategory ? "sidebar-item active" : "sidebar-item"}
            onClick={() => onSelect(category)}
          >
            {formatCategoryLabel(category)}
          </button>
        ))}
      </div>
    </aside>
  );
}
