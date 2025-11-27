import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedShadowStorage = await deploy("ShadowStorage", {
    from: deployer,
    log: true,
  });

  console.log(`ShadowStorage contract: `, deployedShadowStorage.address);
};
export default func;
func.id = "deploy_shadow_storage"; // id required to prevent reexecution
func.tags = ["ShadowStorage"];
