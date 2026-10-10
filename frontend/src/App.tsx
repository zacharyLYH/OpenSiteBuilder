import Home from './pages/Home'
import Callback from './pages/Callback'
import Editor from './pages/Editor'
import Nav from './components/Nav'

export default function App() {
  const path = window.location.pathname
  if (path === '/callback') return <Callback />
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
