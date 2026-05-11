import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { useContract } from "./hooks/useContract";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Courses } from "./pages/Courses";
import { CreateCourse } from "./pages/CreateCourse";
import { MyCertificates } from "./pages/MyCertificates";

export default function App() {
  const { account, signer, connect, disconnect } = useWallet();
  const { courseRegistry, certificateNFT } = useContract(signer);

  return (
    <BrowserRouter>
      <Navbar account={account} connect={connect} disconnect={disconnect} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/courses"
          element={<Courses account={account} courseRegistry={courseRegistry} />}
        />
        <Route
          path="/create"
          element={
            <CreateCourse account={account} connect={connect} courseRegistry={courseRegistry} />
          }
        />
        <Route
          path="/certificates"
          element={<MyCertificates account={account} certificateNFT={certificateNFT} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
