import React, { Component } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  DeviceEventEmitter,
} from "react-native";
import { RNSerialport, definitions, actions } from "react-native-serialport";
import TcpSocket from 'react-native-tcp-socket';


import Header from "./header"
class ManualConnection extends Component {
  constructor(props) {
    super(props);
    this.state = {
      servisStarted: false,
      connected: false,
      usbAttached: false,
      baudRate: "9600",
      interface: "-1",
      selectedDevice: null,
      deviceList: [{ name: "Device Not Found", placeholder: true }],
      page: 0,
      selectedNetwork: "",
      networkPassword: "",
      availableNetworks: [],
      rotation: 0,
      hostname: "No Device",
      mac_address: "",
      currentNetwork: "------",
      vendor: "------",
      wifiState: "disconnected",
      searching: false,
      returnedDataType: definitions.RETURNED_DATA_TYPES.HEXSTRING
    };

    this.startUsbListener = this.startUsbListener.bind(this);
    this.stopUsbListener = this.stopUsbListener.bind(this);

    this.client = TcpSocket.createConnection({ port: 3000, host: "192.168.242.2" }, () => {
      // Write on the socket
      this.client.setEncoding("ascii")
    });

    this.client.on('error', function (error) {
      console.log(error);
    });

    this.client.on('close', function () {
      console.log('Connection closed!');
    });

    this.client.on('data', (data) => {
      let data2 = data.split("\n")
      data2.map(msg => this.readFrom(msg))
    });
  }

  backAction = () => {
    if (this.state.page == 0) BackHandler.exitApp()
    else this.setState(prev => ({ page: prev.page - 1 }))
    return true;
  };

  componentDidMount() {
    this.client.write("{<wifi::init>}")
    // this.startUsbListener();
  }



  componentWillUnmount() {
    // this.stopUsbListener();
  }


  startUsbListener() {
    DeviceEventEmitter.addListener("hardwareBackPress", this.backAction, this)

    DeviceEventEmitter.addListener(
      actions.ON_SERVICE_STARTED,
      this.onServiceStarted,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_SERVICE_STOPPED,
      this.onServiceStopped,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DEVICE_ATTACHED,
      this.onDeviceAttached,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DEVICE_DETACHED,
      this.onDeviceDetached,
      this
    );
    DeviceEventEmitter.addListener(actions.ON_ERROR, this.onError, this);
    DeviceEventEmitter.addListener(
      actions.ON_CONNECTED,
      this.onConnected,
      this
    );
    DeviceEventEmitter.addListener(
      actions.ON_DISCONNECTED,
      this.onDisconnected,
      this
    );
    DeviceEventEmitter.addListener(actions.ON_READ_DATA, this.onReadData, this);
    RNSerialport.setReturnedDataType(this.state.returnedDataType);
    RNSerialport.setAutoConnect(false);
    RNSerialport.startUsbService();
  }

  stopUsbListener = async () => {
    DeviceEventEmitter.removeAllListeners();
    const isOpen = await RNSerialport.isOpen();
    if (isOpen) {
      Alert.alert("isOpen", isOpen);
      RNSerialport.disconnect();
    }
    RNSerialport.stopUsbService();
  };

  onServiceStarted(response) {
    this.setState({ servisStarted: true });
    if (response.deviceAttached) {
      this.onDeviceAttached();
    }
  }
  onServiceStopped() {
    this.setState({ servisStarted: false });
    Alert.alert("service stopped");
  }
  onDeviceAttached() {
    this.setState({ usbAttached: true });
    this.fillDeviceList().then(() => this.handleConnection())
  }
  onDeviceDetached() {
    this.setState({ usbAttached: false });
    this.setState({ selectedDevice: null });
    this.setState({
      deviceList: [{ name: "Device Not Found", placeholder: true }]
    });
  }
  onConnected() {
    this.setState({ connected: true });
    RNSerialport.writeString("{<wifi::init>}")
  }
  onDisconnected() {
    this.setState({ connected: false });
  }
  onReadData(data) {
    if (
      this.state.returnedDataType === definitions.RETURNED_DATA_TYPES.INTARRAY
    ) {
      const payload = RNSerialport.intArrayToUtf16(data.payload);
    } else if (
      this.state.returnedDataType === definitions.RETURNED_DATA_TYPES.HEXSTRING
    ) {
      const payload = RNSerialport.hexToUtf16(data.payload);
      this.readFrom(payload)
    }
  }

  onError(error) {
    console.error(error);
  }

  fillDeviceList = async () => {
    try {
      const deviceList = await RNSerialport.getDeviceList();
      if (deviceList.length > 0) {
        this.setState({ deviceList });
        this.setState({ selectedDevice: deviceList[0] })
      } else {
        this.setState({
          deviceList: [{ name: "Device Not Found", placeholder: true }]
        });
      }
    } catch (err) {
      Alert.alert(
        "Error from getDeviceList()",
        err.errorCode + " " + err.errorMessage
      );
    }
  };

  postData = async () => {
    console.log('Requesting config data from Nana Server...');
    const json = await fetch('http://iot.nana.sa/', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify({
        mac_address: this.state.mac_address,
        serial_number: this.state.hostname,
        is_all: true
      })
    });
    const data = json.json();
    return data
  } // postData.then(data => ....)

  handleConnection = async () => {
    const isOpen = await RNSerialport.isOpen();
    if (isOpen) {
      RNSerialport.disconnect();
    } else {
      if (!this.state.selectedDevice) {
        alert("No device selected!");
        return;
      }
      RNSerialport.setInterface(parseInt(this.state.interface, 10));
      RNSerialport.connectDevice(
        this.state.selectedDevice.name,
        parseInt(this.state.baudRate, 10)
      );
    }
  };

  buttonStyle = status => {
    return status
      ? styles.button
      : Object.assign({}, styles.button, { backgroundColor: "#C0C0C0" });
  };

  readFrom = (message) => {
    console.log(message)
    const x = message.indexOf("::");
    if (x > 0) {
      const end = message.indexOf(">}");
      const key = message.substring(2, x);
      const value = message.substring(x + 2, end);
      const i = value.indexOf("||");
      if (i > 0) {
        const subKey = value.substring(0, i);
        const subVal = value.substring(i + 2);
        this.setState({ wifiState: subKey, currentNetwork: subVal })
      }
      if (key == "hostname") {
        this.setState({ hostname: value })
      } else if (key == "mac") {
        this.setState({ mac_address: value })
      }
      else if (key == "ssid") {
        this.setState({ currentNetwork: value, wifiState: value !== "" ? "connected" : "disconnected" })
      } else if (key == "vendor") {
        this.setState({ vendor: value })
      } else if (key == "config") {
        Alert.alert("config saved successfully!");
      } else if (key == "wifi" && value == "saved||" + this.state.selectedNetwork) {
        Alert.alert("Network saved successfully!");
        this.sendData("{<wifi::init>}")
      } else if (key == "wifis") {
        if (value == "clear") {
          this.setState({ availableNetworks: [] })
        } else if (value == "none") {
          // do nothing
        } else if (value == "done") {
          this.setState({ searching: false })
        }
        else {
          console.log(key, message)
          this.setState({ availableNetworks: [...this.state.availableNetworks, value] })
        }
      }
    }
  }

  sendData = data => {
    // RNSerialport.writeString(data);
    this.client.write(data);
  }

  render() {
    const spinValue = new Animated.Value(0);
    const spinValue2 = new Animated.Value(0);

    Animated.loop(
      Animated.timing(
        spinValue,
        {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true
        }
      )
    ).start();
    Animated.loop(
      Animated.timing(
        spinValue2,
        {
          toValue: 1,
          duration: 16000,
          easing: Easing.linear,
          useNativeDriver: true
        }
      )
    ).start();

    // Next, interpolate beginning and end values (in this case 0 and 1)
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })
    const spin2 = spinValue2.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })

    const connectCondition = this.state.wifiState === "connecting" && (this.state.currentNetwork === this.state.selectedNetwork);
    const saveCondition = this.state.wifiState === "connected" && (this.state.currentNetwork === this.state.selectedNetwork);

    return (
      <View style={styles.view}>
        <Header />
        {this.state.page == 0 &&
          <View style={styles.startButtons}>
            <TouchableOpacity style={styles.startButton} onPress={() => {
              this.setState({ page: 1 })
            }}>
              <Text style={styles.startButtonText}>
                WiFi Settings
            </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startButton} onPress={() => {
              this.postData().then(data => {
                data = data["result"]["device"]
                let wifi_name, wifi_password, store_id, update_rate;
                wifi_name = data["wifi_name"] ? `"wifi_name":"${data["wifi_name"]}",` : "";
                wifi_password = data["wifi_password"] ? `"wifi_password":"${data["wifi_password"]}",` : "";
                store_id = data["store_id"] ? `"store_id":"${data["store_id"]}",` : "";
                update_rate = data["update_rate"] ? `"update_rate":"${data["update_rate"]}",` : "";
                const config = `{<config::{${store_id}${update_rate}${wifi_name}${wifi_password}}>}`;
                this.sendData(config)
              })
            }
            }>
              <Text style={styles.startButtonText}>
                Link with Store
            </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.startButton, { display: "none" }]}>
              <Text style={styles.startButtonText}>
                APN (SIM) Settings
            </Text>
            </TouchableOpacity>
          </View>
        }
        {this.state.page == 1 &&
          <View style={styles.main}>
            <View style={styles.row1}>
              <Text style={styles.deviceName}>{this.state.hostname}</Text>
              <Image source={require("./box.png")} style={styles.smallBox} />
            </View>
            <View style={styles.row2}>
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 20 }}>
                {this.state.currentNetwork !== "------" ?
                  <Image source={require("./ovalConnected.png")} style={styles.smalloval} /> :
                  <Image source={require("./ovalDisconnected.png")} style={styles.smalloval} />
                }

                <Text style={styles.connected}>{this.state.wifiState}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                <Image source={require("./wifi.png")} style={styles.wifi} />
                <Text style={styles.ssid}>{this.state.currentNetwork}</Text>
              </View>
            </View>
            <View style={styles.row3}>
              <Image source={require("./barcode.png")} style={styles.barcode} />
              <Text style={styles.barcodeDevice}>{this.state.vendor}</Text>
            </View>
            {this.state.searching ?
              <TouchableOpacity style={{ width: 30, alignSelf: "flex-end" }} disabled>
                <Image source={require("./searching.gif")} style={styles.refresh} />
              </TouchableOpacity>
              :
              <TouchableOpacity style={{ width: 30, alignSelf: "flex-end" }} onPress={() => {
                this.sendData("{<wifi::list>}\n")
                this.setState({ searching: true })
              }}>
                <Image source={require("./refresh.png")} style={styles.refresh} />
              </TouchableOpacity>
            }
            <ScrollView>
              {
                this.state.availableNetworks.length > 0 && this.state.availableNetworks.map(network => (
                  <TouchableOpacity style={styles.listItem} onPress={() => this.setState({ page: 2, selectedNetwork: network })} key={network}>
                    <Text style={styles.listItemText}>{network}</Text>
                  </TouchableOpacity>
                ))
              }
              {this.state.availableNetworks.length == 0 && (
                <TouchableOpacity style={styles.listItem} disabled>
                  <Text style={styles.listItemText}>No Networks Found!</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        }
        {this.state.page == 2 &&
          <View style={styles.main}>
            <View style={styles.row1}>
              <Text style={styles.deviceName}>{this.state.hostname}</Text>
              <Image source={require("./box.png")} style={styles.smallBox} />
            </View>
            <View style={styles.row2}>
              <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 20 }}>
                {this.state.wifiState == "connected" &&
                  <Image source={require("./ovalConnected.png")} style={styles.smalloval} />
                }
                {this.state.wifiState == "connecting" &&
                  <Image source={require("./ovalConnecting.png")} style={styles.smalloval} />
                }
                {this.state.wifiState == "failed" &&
                  <Image source={require("./ovalfailed.png")} style={styles.smalloval} />
                }
                <Text style={styles.connected}>{this.state.wifiState}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                <Image source={require("./wifi.png")} style={styles.wifi} />
                <Text style={styles.ssid}>{this.state.currentNetwork}</Text>
              </View>
            </View>
            <View style={styles.row3}>
              <Image source={require("./barcode.png")} style={styles.barcode} />
              <Text style={styles.barcodeDevice}>{this.state.vendor}</Text>
            </View>
            <View style={styles.network}>
              <Text style={styles.networkTitle}>{this.state.selectedNetwork}</Text>
              <TextInput placeholder={"Password"} style={styles.password}
                placeholder={"Enter a password"}
                onChangeText={(text) => {
                  this.setState({ networkPassword: text })
                }} />
              <View style={styles.networkButtons}>
                <TouchableOpacity
                  disabled={connectCondition}
                  style={[styles.networkConnect, {
                    backgroundColor: connectCondition ? '#C5C5C5' : "#66C200",
                    borderColor: connectCondition ? '#C5C5C5' : "#66C200"
                  }]} onPress={() => {
                    if (this.state.networkPassword.length < 8) {
                      Alert.alert("Password is invalid!");

                    } else {
                      this.setState({ wifiState: 'connecting', currentNetwork: this.state.selectedNetwork })
                      this.sendData("{<wifi::" + this.state.selectedNetwork + "||" + this.state.networkPassword + ">}\n")
                    }
                  }}>
                  <Text style={styles.networkButtonTitle}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.networkSave, {
                  backgroundColor: saveCondition ? "#66C200" : '#C5C5C5',
                  borderColor: saveCondition ? "#66C200" : '#C5C5C5'
                }]} disabled={!saveCondition}
                  onPress={() => {
                    this.sendData("{<wifi::save>}")
                  }}
                >
                  <Text style={styles.networkButtonTitle}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  view: {
    flex: 1,
    justifyContent: "space-between",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "white",
  },
  startButtons: {
    width: 370 - 22,
    height: 400,
    marginTop: 330,
    marginBottom: 15,
    justifyContent: "space-evenly"
  },
  startButton: {
    width: "100%",
    backgroundColor: "#66C200",
    borderColor: "#66C200",
    borderRadius: 8,
    height: 60,
    justifyContent: "center",
    alignItems: "flex-start"

  },
  startButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 35,
    color: "white",
    borderRadius: 8,
  },
  main: {
    width: '90%',
    height: 500,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#B6B6B6",
    elevation: 16,
    marginBottom: 30,
  },
  row1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  deviceName: {
    fontSize: 30,
    marginLeft: 20,
    marginTop: 10,
  },
  smallBox: {
    width: 65,
    height: 57,
    marginRight: 15,
    marginTop: 10
  },
  smalloval: {
    width: 40,
    height: 40,
    borderColor: "black",
  },
  connected: {
    fontSize: 15,
    marginLeft: -3
  },
  ssid: {
    fontSize: 15,
  },
  wifi: {
    width: 28,
    height: 28,
    marginBottom: 7
  },
  row3: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5
  },
  barcode: {
    width: 22,
    height: 22,
    marginLeft: 20,
    marginRight: 10
  },
  refresh: {
    width: 22,
    height: 22,
    marginLeft: 20,
    marginRight: 10,
    alignSelf: "flex-end",
    marginBottom: 10
  },
  barcodeDevice: {
    fontSize: 12
  },
  row4: {
    borderWidth: 1,
    width: '90%',
    height: 220,
    alignSelf: "center",
    borderRadius: 8,
    justifyContent: "flex-start",
    borderColor: '#BEBEBE'
  },
  listItem: {
    borderBottomWidth: 0.5,
    padding: 15
  },
  listItemText: {
    fontSize: 17,
    color: '#818181',
    marginLeft: 10,
  },

  network: {
    borderWidth: 1,
    width: '90%',
    borderColor: '#818181',
    height: '60%',
    alignSelf: "center",
    marginTop: 15,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 30
  },
  networkTitle: {
    fontSize: 22,
    color: '#818181',
  },
  password: {
    borderWidth: 0.3,
    width: '100%',
    padding: 10,
    borderColor: "#818181",
    borderRadius: 8,
    marginTop: 20,
    fontSize: 18
  },
  networkButtons: {
    flexDirection: "row",
    marginTop: 20,
    width: '100%',
    justifyContent: "space-between"
  },
  networkButtonTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "bold"
  },
  networkConnect: {
    width: '40%',
    height: "60%",
    borderRadius: 8,
    backgroundColor: "#66C200",
    borderColor: "#66C200",
    justifyContent: "center",
    alignItems: "center"
  },
  networkSave: {
    width: '40%',
    height: "60%",
    borderRadius: 8,
    backgroundColor: "#C5C5C5",
    borderColor: "#C5C5C5",
    justifyContent: "center",
    alignItems: "center",
  }
});

export default ManualConnection;