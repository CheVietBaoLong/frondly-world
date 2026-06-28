import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";

import { TabBar } from "@/components/tab-bar";

// Headless tab navigator (expo-router/ui). TabList declares the routes; TabBar
// renders the visible citron-pill bar. Garden is the index (href "/").
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList style={{ display: "none" }}>
        <TabTrigger name="garden" href="/" />
        <TabTrigger name="add" href="/add" />
        <TabTrigger name="care" href="/care" />
        <TabTrigger name="forage" href="/forage" />
      </TabList>
      <TabBar />
    </Tabs>
  );
}
