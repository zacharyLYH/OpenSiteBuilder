import Home from './pages/Home'
import Callback from './pages/Callback'
import Editor from './pages/Editor'
import Nav from './components/Nav'
import OsbMount from './osb/mount'

export default function App() {
  const path = window.location.pathname
  if (path === '/callback') return <Callback />
  // Dev-only screenshot mount for e2e specs. Never linked in prod.
  if (path === '/osb-mount' && import.meta.env.DEV) return <OsbMount />
  if (path === '/editor')
    return (
      <>
        <Nav />
        <Editor />
      </>
    )
  return (
    <>
      <Nav />
      <Home />
    </>
  )
}
