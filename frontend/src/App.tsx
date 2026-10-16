import Home from './pages/Home'
import Callback from './pages/Callback'
import CanvasPage from './list/Canvas'
import Nav from './components/Nav'
import OsbMount from './osb/mount'

export default function App() {
  const path = window.location.pathname
  if (path === '/callback') return <Callback />
  // Dev-only screenshot mount for e2e specs. Never linked in prod.
  if (path === '/osb-mount' && import.meta.env.DEV) return <OsbMount />
  if (path === '/canvas') return <CanvasPage />
  return (
    <>
      <Nav />
      <Home />
    </>
  )
}
