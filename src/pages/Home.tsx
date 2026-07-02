import { Link } from 'react-router-dom';

const restaurants = [
  { name: 'Мангал', slug: 'mangal', description: 'Ресторанный каталог' },
  { name: 'Rizih', slug: 'rizih', description: 'Ресторанный каталог' }
];

export function Home() {
  return (
    <main style={styles.shell}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <p style={styles.kicker}>Платформа ресторанных каталогов</p>
          <h1 style={styles.title}>WayCatalog</h1>
        </div>

        <label style={styles.searchLabel}>
          <span style={styles.searchText}>Поиск</span>
          <input style={styles.searchInput} type="search" placeholder="Найти ресторан" />
        </label>

        <div style={styles.list} aria-label="Список ресторанов">
          {restaurants.map((restaurant) => (
            <Link key={restaurant.slug} style={styles.restaurantLink} to={`/${restaurant.slug}`}>
              <span>
                <strong style={styles.restaurantName}>{restaurant.name}</strong>
                <small style={styles.restaurantDescription}>{restaurant.description}</small>
              </span>
              <span style={styles.restaurantSlug}>#/{restaurant.slug}</span>
            </Link>
          ))}
        </div>

        <div style={styles.actions}>
          <button style={styles.primaryButton} type="button">Войти</button>
          <button style={styles.secondaryButton} type="button">Регистрация</button>
          <button style={styles.ghostButton} type="button">Пропустить</button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '32px 18px',
    background: '#f6f7f9',
    color: '#111827'
  },
  panel: {
    width: 'min(100%, 560px)',
    display: 'grid',
    gap: 22
  },
  header: {
    display: 'grid',
    gap: 8
  },
  kicker: {
    margin: 0,
    color: '#5b6472',
    fontSize: 15,
    fontWeight: 700
  },
  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1,
    fontWeight: 900
  },
  searchLabel: {
    display: 'grid',
    gap: 8
  },
  searchText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: 800
  },
  searchInput: {
    width: '100%',
    minHeight: 52,
    border: '1px solid #d8dde6',
    borderRadius: 8,
    padding: '0 16px',
    background: '#ffffff',
    color: '#111827',
    outline: 'none'
  },
  list: {
    display: 'grid',
    gap: 10
  },
  restaurantLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 70,
    padding: '14px 16px',
    border: '1px solid #e1e5ec',
    borderRadius: 8,
    background: '#ffffff',
    color: '#111827'
  },
  restaurantName: {
    display: 'block',
    fontSize: 18
  },
  restaurantDescription: {
    display: 'block',
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13
  },
  restaurantSlug: {
    flex: '0 0 auto',
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: 800
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10
  },
  primaryButton: {
    minHeight: 46,
    border: 0,
    borderRadius: 8,
    background: '#111827',
    color: '#ffffff',
    fontWeight: 800
  },
  secondaryButton: {
    minHeight: 46,
    border: '1px solid #cfd6e2',
    borderRadius: 8,
    background: '#ffffff',
    color: '#111827',
    fontWeight: 800
  },
  ghostButton: {
    minHeight: 46,
    border: '1px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    color: '#4b5563',
    fontWeight: 800
  }
} satisfies Record<string, React.CSSProperties>;
