import './globals.css';
export const metadata={title:'Folio — Your reading, waiting',description:'Save something good. Come back when you have a moment.',manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg',apple:'/icon-192.png'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#f7f6f2'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
